import { useEffect, useReducer, useRef, useState } from 'react';

import { completeWordAttempt, updateWord } from '../../db/repo';
import type { SessionMode, StoredWord } from '../../db/schema';
import {
  getAudioSettings,
  getGeminiSettings,
  getSavedCapabilityReport,
  saveCapabilityReport,
  type AudioSettings,
  type GeminiSettings,
  type SavedCapabilityReport,
} from '../../db/settings';
import { meaningMatch } from '../../domain/meaningMatch';
import { pronunciationMatch } from '../../domain/pronMatch';
import {
  detectDeviceCapabilities,
  detectStaticCapabilities,
  fallbackAfterWebSpeechFailures,
  resolvePronunciationMode,
  type ActivePronunciationMode,
} from '../../services/capabilities';
import {
  GeminiServiceError,
  judgeMeaningAudio,
  judgeMeaningText,
  judgePronunciationAudio,
} from '../../services/gemini';
import { AudioRecorderError, recordAudioClip } from '../../services/recorder';
import {
  recognizeOnce,
  SpeechRecognitionAttemptError,
  type SpeechRecognitionErrorCode,
} from '../../services/speechRecognition';
import { speakText } from '../../services/tts';
import { useBlockAppUpdatesWhile } from '../../ui/AppUpdate';
import {
  cardReducer,
  initialCardState,
  type CardState,
  type MeaningEvaluation,
  type PronunciationEvaluation,
} from './cardMachine';

const CAPABILITY_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const FATAL_WEB_SPEECH_ERRORS = new Set<SpeechRecognitionErrorCode>([
  'service-not-allowed',
  'not-allowed',
  'network',
  'language-not-supported',
]);

interface Setup {
  audio: AudioSettings;
  gemini: GeminiSettings;
  savedCapability: SavedCapabilityReport | null;
}

interface SessionRunnerProps {
  words: StoredWord[];
  mode: SessionMode;
  onExit: () => void;
}

function modeName(mode: ActivePronunciationMode): string {
  if (mode === 'webspeech') return 'Mod A · Web Speech';
  if (mode === 'gemini') return 'Mod B · Gemini';
  return 'Elle değerlendirme';
}

export function SessionRunner({ words, mode, onExit }: SessionRunnerProps) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [activeMode, setActiveMode] = useState<ActivePronunciationMode>('manual');
  const [canRecord, setCanRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [manualMeaning, setManualMeaning] = useState('');
  const [newMeaningAdded, setNewMeaningAdded] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const fatalWebSpeechErrors = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const firstWord = words[0]!;
  const [card, dispatch] = useReducer(cardReducer, initialCardState(firstWord.id));
  const word = words[index]!;

  useBlockAppUpdatesWhile(started && !finished);

  useEffect(() => {
    let active = true;
    void Promise.all([getAudioSettings(), getGeminiSettings(), getSavedCapabilityReport()])
      .then(([audio, gemini, savedCapability]) => {
        if (active) setSetup({ audio, gemini, savedCapability });
      })
      .catch(() => {
        if (active) setNotice('Test ayarları okunamadı. Sayfayı yeniden açın.');
      });
    return () => {
      active = false;
      operation.current?.abort();
    };
  }, []);

  function freshSignal(): AbortSignal {
    operation.current?.abort();
    operation.current = new AbortController();
    return operation.current.signal;
  }

  async function say(text: string, lang: string, voiceURI: string): Promise<void> {
    try {
      await speakText({ text, lang, voiceURI, signal: freshSignal() });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setNotice('Ses çalınamadı; ekrandaki yönergelerle devam edebilirsiniz.');
      }
    }
  }

  async function prepareSession() {
    if (!setup) return;
    setPreparing(true);
    setNotice('');
    try {
      const staticCapabilities = detectStaticCapabilities();
      const saved = setup.savedCapability;
      const savedIsFresh = Boolean(
        saved
        && saved.accent === setup.audio.accent
        && Date.now() - saved.testedAt < CAPABILITY_MAX_AGE_MS,
      );
      let resolvedMode: ActivePronunciationMode;
      if (savedIsFresh && setup.audio.pronunciationMode === 'auto') {
        resolvedMode = resolvePronunciationMode({
          preference: 'auto',
          recognitionWorking: saved!.activeMode === 'webspeech',
          audioRecording: staticCapabilities.audioRecording,
          hasGeminiKey: Boolean(setup.gemini.apiKey),
        });
      } else {
        const report = await detectDeviceCapabilities({
          preference: setup.audio.pronunciationMode,
          accent: setup.audio.accent,
          hasGeminiKey: Boolean(setup.gemini.apiKey),
          staticCapabilities,
        });
        resolvedMode = report.activeMode;
        await saveCapabilityReport({
          activeMode: report.activeMode,
          reason: report.recognitionProbe.working
            ? 'webspeech-working'
            : report.recognitionProbe.reason ?? 'unknown',
          accent: setup.audio.accent,
          testedAt: Date.now(),
          textToSpeech: report.textToSpeech,
          audioRecording: report.audioRecording,
        });
      }
      setCanRecord(staticCapabilities.audioRecording);
      setActiveMode(resolvedMode);
      setStarted(true);
    } catch (error) {
      setActiveMode('manual');
      setStarted(true);
      setNotice(error instanceof Error ? error.message : 'Cihaz testi tamamlanamadı; elle moda geçildi.');
    } finally {
      setPreparing(false);
    }
  }

  async function beginWord(target: StoredWord = word) {
    if (!setup) return;
    setBusy(true);
    setNotice('');
    dispatch({ type: 'BEGIN' });
    await say(target.term, setup.audio.accent, setup.audio.englishVoiceURI);
    dispatch({ type: 'WORD_SPOKEN' });
    setBusy(false);
  }

  async function replayWord() {
    if (!setup) return;
    setBusy(true);
    await say(word.term, setup.audio.accent, setup.audio.englishVoiceURI);
    setBusy(false);
  }

  async function speakPronunciationFeedback(result: PronunciationEvaluation) {
    if (!setup?.audio.spokenFeedback) return;
    await say(
      result.correct ? 'Doğru telaffuz.' : result.near ? 'Yakındı, ancak doğru değil.' : 'Yanlış telaffuz.',
      'tr-TR',
      setup.audio.turkishVoiceURI,
    );
    if (!result.correct) await say(word.term, setup.audio.accent, setup.audio.englishVoiceURI);
  }

  async function deliverPronunciation(result: PronunciationEvaluation) {
    dispatch({ type: 'PRONUNCIATION_RESULT', result });
    setBusy(true);
    await speakPronunciationFeedback(result);
    setBusy(false);
  }

  function invalidPronunciation(message: string) {
    dispatch({ type: 'PRONUNCIATION_INVALID', message });
    setNotice(message);
  }

  function webSpeechFailureMessage(error: unknown): string {
    if (error instanceof SpeechRecognitionAttemptError && FATAL_WEB_SPEECH_ERRORS.has(error.code)) {
      fatalWebSpeechErrors.current += 1;
      const fallback = fallbackAfterWebSpeechFailures({
        consecutiveFailures: fatalWebSpeechErrors.current,
        audioRecording: canRecord,
        hasGeminiKey: Boolean(setup?.gemini.apiKey),
      });
      if (fallback) {
        setActiveMode(fallback);
        fatalWebSpeechErrors.current = 0;
        return `Web Speech iki kez çalışmadı. ${modeName(fallback)} moduna geçildi; tekrar deneyin.`;
      }
    } else {
      fatalWebSpeechErrors.current = 0;
    }
    return error instanceof Error ? error.message : 'Dinleme tamamlanamadı. Tekrar deneyin.';
  }

  async function listenPronunciation() {
    if (!setup) return;
    dispatch({ type: 'START_PRONUNCIATION' });
    setBusy(true);
    setNotice('');
    try {
      if (activeMode === 'webspeech') {
        const alternatives = await recognizeOnce({
          lang: setup.audio.accent,
          maxDurationMs: 5_000,
          signal: freshSignal(),
        });
        fatalWebSpeechErrors.current = 0;
        const match = pronunciationMatch(alternatives.map((item) => item.transcript), word.term);
        await deliverPronunciation({
          correct: match.correct,
          heard: match.heard,
          method: 'webspeech',
          overridden: false,
          near: match.near,
        });
        return;
      }

      if (activeMode === 'gemini') {
        const recording = await recordAudioClip({ maxDurationMs: 4_000, signal: freshSignal() });
        if (recording.isSilent) {
          invalidPronunciation('Ses duyulmadı. Sonuç kaydedilmedi; tekrar deneyin.');
          return;
        }
        const judged = await judgePronunciationAudio({
          apiKey: setup.gemini.apiKey,
          model: setup.gemini.judgeModel,
          term: word.term,
          accent: setup.audio.accent,
          audio: recording.blob,
          mimeType: recording.mimeType,
          signal: freshSignal(),
        });
        if (judged.verdict === 'unclear') {
          invalidPronunciation('Kayıt anlaşılamadı. Sonuç kaydedilmedi; tekrar deneyin.');
          return;
        }
        await deliverPronunciation({
          correct: judged.verdict === 'correct',
          heard: judged.heard,
          method: 'gemini',
          overridden: false,
          feedback: judged.feedback_tr,
        });
      }
    } catch (error) {
      if (activeMode === 'webspeech') {
        invalidPronunciation(webSpeechFailureMessage(error));
      } else if (error instanceof GeminiServiceError) {
        setActiveMode('manual');
        invalidPronunciation(`${error.message} Elle değerlendirmeye geçildi.`);
      } else {
        invalidPronunciation(error instanceof Error ? error.message : 'Kayıt tamamlanamadı.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function setManualPronunciation(correct: boolean) {
    await deliverPronunciation({
      correct,
      heard: correct ? word.term : '',
      method: 'self',
      overridden: false,
    });
  }

  async function promptMeaning() {
    if (!setup) return;
    dispatch({ type: 'PROMPT_MEANING' });
    setBusy(true);
    if (setup.audio.spokenFeedback) {
      await say('Şimdi Türkçe anlamını söyleyin.', 'tr-TR', setup.audio.turkishVoiceURI);
    }
    setBusy(false);
  }

  async function speakMeaningFeedback(result: MeaningEvaluation) {
    if (!setup?.audio.spokenFeedback) return;
    await say(
      result.correct ? 'Doğru.' : `Yanlış. Doğru anlamı: ${word.meanings.join(', ')}.`,
      'tr-TR',
      setup.audio.turkishVoiceURI,
    );
  }

  async function deliverMeaning(result: MeaningEvaluation) {
    dispatch({ type: 'MEANING_RESULT', result });
    setBusy(true);
    await speakMeaningFeedback(result);
    setBusy(false);
  }

  function meaningNeedsSelfCheck(transcript: string, message: string) {
    dispatch({ type: 'MEANING_SELF_CHECK', transcript, message });
    setNotice(message);
  }

  async function evaluateMeaningTranscripts(transcripts: string[]) {
    if (!setup) return;
    const local = meaningMatch(transcripts, word.meanings);
    if (local.correct) {
      await deliverMeaning({
        correct: true,
        transcript: local.transcript,
        method: 'match',
        overridden: false,
      });
      return;
    }
    if (!setup.gemini.apiKey) {
      meaningNeedsSelfCheck(local.transcript, 'Otomatik eşleşme bulunamadı. Cevabınızı siz değerlendirin.');
      return;
    }
    try {
      const judged = await judgeMeaningText({
        apiKey: setup.gemini.apiKey,
        model: setup.gemini.judgeModel,
        term: word.term,
        meanings: word.meanings,
        transcripts,
        signal: freshSignal(),
      });
      if (judged.verdict === 'unsure') {
        meaningNeedsSelfCheck(judged.transcript, 'Gemini bu cevaptan emin olamadı. Kararı siz verin.');
        return;
      }
      await deliverMeaning({
        correct: judged.verdict === 'correct',
        transcript: judged.transcript,
        method: 'gemini',
        overridden: false,
        reason: judged.reason_tr,
        isNewValidMeaning: judged.is_new_valid_meaning,
      });
    } catch (error) {
      meaningNeedsSelfCheck(
        local.transcript,
        `${error instanceof Error ? error.message : 'Otomatik değerlendirme yapılamadı.'} Kararı siz verin.`,
      );
    }
  }

  async function listenMeaning() {
    if (!setup) return;
    dispatch({ type: 'START_MEANING' });
    setBusy(true);
    setNotice('');
    try {
      if (activeMode === 'webspeech') {
        const alternatives = await recognizeOnce({
          lang: 'tr-TR',
          maxDurationMs: 6_000,
          signal: freshSignal(),
        });
        fatalWebSpeechErrors.current = 0;
        await evaluateMeaningTranscripts(alternatives.map((item) => item.transcript));
        return;
      }
      if (activeMode === 'gemini') {
        const recording = await recordAudioClip({ maxDurationMs: 4_000, signal: freshSignal() });
        if (recording.isSilent) {
          dispatch({ type: 'MEANING_INVALID', message: 'Ses duyulmadı. Sonuç kaydedilmedi; tekrar deneyin.' });
          return;
        }
        const judged = await judgeMeaningAudio({
          apiKey: setup.gemini.apiKey,
          model: setup.gemini.judgeModel,
          term: word.term,
          meanings: word.meanings,
          audio: recording.blob,
          mimeType: recording.mimeType,
          signal: freshSignal(),
        });
        if (judged.verdict === 'unsure') {
          meaningNeedsSelfCheck(judged.transcript, 'Sesli cevap anlaşılamadı. Kararı siz verin.');
          return;
        }
        await deliverMeaning({
          correct: judged.verdict === 'correct',
          transcript: judged.transcript,
          method: 'gemini',
          overridden: false,
          reason: judged.reason_tr,
          isNewValidMeaning: judged.is_new_valid_meaning,
        });
      }
    } catch (error) {
      if (activeMode === 'webspeech' && error instanceof SpeechRecognitionAttemptError) {
        const message = webSpeechFailureMessage(error);
        dispatch({ type: 'MEANING_INVALID', message });
        setNotice(message);
      } else if (error instanceof AudioRecorderError) {
        dispatch({ type: 'MEANING_INVALID', message: error.message });
        setNotice(error.message);
      } else {
        meaningNeedsSelfCheck('', `${error instanceof Error ? error.message : 'Değerlendirme yapılamadı.'} Kararı siz verin.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitManualMeaning() {
    const transcript = manualMeaning.trim();
    if (!transcript) {
      setNotice('Önce Türkçe cevabınızı yazın.');
      return;
    }
    dispatch({ type: 'START_MEANING' });
    setBusy(true);
    setNotice('');
    await evaluateMeaningTranscripts([transcript]);
    setBusy(false);
  }

  async function setSelfMeaning(correct: boolean) {
    dispatch({ type: 'SELF_MEANING_RESULT', correct });
    setBusy(true);
    await speakMeaningFeedback({
      correct,
      transcript: card.pendingMeaningTranscript,
      method: 'self',
      overridden: false,
    });
    setBusy(false);
  }

  async function addNewMeaning() {
    const transcript = card.meaning?.transcript.trim();
    if (!transcript || word.meanings.some((meaning) => meaning.toLocaleLowerCase('tr-TR') === transcript.toLocaleLowerCase('tr-TR'))) return;
    try {
      await updateWord(word.id, { meanings: [...word.meanings, transcript] });
      setNewMeaningAdded(true);
      setNotice('Yeni doğru anlam kelimeye eklendi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Yeni anlam eklenemedi.');
    }
  }

  async function persistCard(snapshot: CardState = card) {
    if (!snapshot.pronunciation || !snapshot.meaning || snapshot.step !== 'meaning_feedback' || busy) return;
    dispatch({ type: 'SAVE' });
    setBusy(true);
    try {
      await completeWordAttempt({
        wordId: word.id,
        sessionId: sessionId.current,
        mode,
        pron: snapshot.pronunciation,
        meaning: snapshot.meaning,
        invalidRetries: snapshot.invalidRetries,
      });
      dispatch({ type: 'SAVED' });
      if (index >= words.length - 1) {
        setFinished(true);
        return;
      }
      const nextIndex = index + 1;
      const nextWord = words[nextIndex]!;
      setIndex(nextIndex);
      setManualMeaning('');
      setNewMeaningAdded(false);
      dispatch({ type: 'RESET', wordId: nextWord.id });
      if (setup?.audio.autoAdvance) await beginWord(nextWord);
    } catch (error) {
      dispatch({ type: 'SAVE_FAILED', message: error instanceof Error ? error.message : 'Sonuç kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (card.step !== 'meaning_feedback' || !setup?.audio.autoAdvance || busy) return undefined;
    const timer = window.setTimeout(() => void persistCard(card), 2_500);
    return () => window.clearTimeout(timer);
  }, [card, busy, setup?.audio.autoAdvance]);

  if (!setup) {
    return <div className="empty-state"><p>{notice || 'Test ayarları hazırlanıyor…'}</p></div>;
  }

  if (!started) {
    return (
      <div className="empty-state session-start">
        <span className="empty-state__icon" aria-hidden="true">▶</span>
        <h3>{words.length} kelimelik çalışma</h3>
        <p>Başlat düğmesi cihazın konuşma yöntemini güvenli biçimde seçer. İlk kelime ayrı dokunuşla okunur.</p>
        <button className="primary-button" type="button" onClick={() => void prepareSession()} disabled={preparing}>
          {preparing ? 'Cihaz hazırlanıyor…' : 'Oturumu hazırla'}
        </button>
        <button className="filter-clear" type="button" onClick={onExit}>Geri dön</button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="empty-state session-complete">
        <span className="empty-state__icon" aria-hidden="true">✓</span>
        <h3>Çalışma tamamlandı</h3>
        <p>{words.length} kelimenin sonuçları ve grupları kaydedildi.</p>
        <button className="primary-button" type="button" onClick={onExit}>Test türlerine dön</button>
      </div>
    );
  }

  const resultClass = (correct: boolean) => correct ? 'feedback-card--correct' : 'feedback-card--wrong';

  return (
    <section className="session-runner" aria-labelledby="current-word">
      <div className="session-toolbar">
        <div>
          <strong>{index + 1}/{words.length}</strong>
          <span>{modeName(activeMode)} · {word.group ? `Grup ${word.group}` : 'Yeni'}</span>
        </div>
        <button className="filter-clear" type="button" onClick={onExit} disabled={busy}>Oturumu bitir</button>
      </div>

      <article className="flashcard">
        <p className="eyebrow">İngilizce kelime</p>
        <h2 id="current-word">{word.term}</h2>
        {word.partOfSpeech ? <span className="group-chip">{word.partOfSpeech}</span> : null}
        <button className="secondary-button listen-again" type="button" onClick={() => void replayWord()} disabled={busy}>
          🔊 Tekrar dinle
        </button>
      </article>

      {card.step === 'ready' ? (
        <button className="primary-button session-main-action" type="button" onClick={() => void beginWord()} disabled={busy}>
          {index === 0 ? 'İlk kartı sesli başlat' : 'Sonraki kelimeyi başlat'}
        </button>
      ) : null}
      {card.step === 'speaking_word' ? <p className="listening-status">🔊 Kelime okunuyor…</p> : null}

      {card.step === 'pron_prompt' ? (
        <div className="test-action-card">
          <h3>Şimdi kelimeyi okuyun</h3>
          {activeMode === 'manual' ? (
            <div className="button-row button-row--wrap">
              <button className="primary-button" type="button" onClick={() => void setManualPronunciation(true)} disabled={busy}>Doğru okudum</button>
              <button className="secondary-button" type="button" onClick={() => void setManualPronunciation(false)} disabled={busy}>Okuyamadım</button>
            </div>
          ) : (
            <button className="microphone-button" type="button" onClick={() => void listenPronunciation()} disabled={busy}>
              🎤 Telaffuzumu dinle
            </button>
          )}
        </div>
      ) : null}
      {card.step === 'pron_listening' ? <p className="listening-status">🎤 Dinleniyor…</p> : null}

      {card.step === 'pron_feedback' && card.pronunciation ? (
        <div className={`feedback-card ${resultClass(card.pronunciation.correct)}`}>
          <strong>{card.pronunciation.correct ? '✓ Doğru telaffuz' : card.pronunciation.near ? '✕ Yakındı' : '✕ Yanlış telaffuz'}</strong>
          {card.pronunciation.heard ? <span>Duyulan: {card.pronunciation.heard}</span> : null}
          {card.pronunciation.feedback ? <span>{card.pronunciation.feedback}</span> : null}
          <button className="feedback-override" type="button" onClick={() => dispatch({ type: 'OVERRIDE_PRONUNCIATION' })} disabled={busy}>Karar yanlış, düzelt</button>
          <button className="primary-button" type="button" onClick={() => void promptMeaning()} disabled={busy}>Anlam sorusuna geç</button>
        </div>
      ) : null}

      {card.step === 'meaning_prompt' ? (
        <div className="test-action-card">
          <h3>Türkçe anlamını söyleyin</h3>
          {activeMode === 'manual' ? (
            <div className="data-form">
              <label><span>Cevabınız</span><input value={manualMeaning} onChange={(event) => setManualMeaning(event.target.value)} placeholder="Türkçe anlamı yazın" /></label>
              <button className="primary-button" type="button" onClick={() => void submitManualMeaning()} disabled={busy}>Cevabı değerlendir</button>
            </div>
          ) : (
            <button className="microphone-button" type="button" onClick={() => void listenMeaning()} disabled={busy}>🎤 Anlamı dinle</button>
          )}
        </div>
      ) : null}
      {card.step === 'meaning_listening' ? <p className="listening-status">🎤 Cevap dinleniyor ve değerlendiriliyor…</p> : null}

      {card.step === 'meaning_self_check' ? (
        <div className="test-action-card">
          <h3>Kararı siz verin</h3>
          <p>Duyulan/yazılan: {card.pendingMeaningTranscript || 'Metin alınamadı'}</p>
          <div className="button-row button-row--wrap">
            <button className="primary-button" type="button" onClick={() => void setSelfMeaning(true)} disabled={busy}>Doğru</button>
            <button className="secondary-button" type="button" onClick={() => void setSelfMeaning(false)} disabled={busy}>Yanlış</button>
          </div>
        </div>
      ) : null}

      {card.step === 'meaning_feedback' && card.meaning ? (
        <div className={`feedback-card ${resultClass(card.meaning.correct)}`}>
          <strong>{card.meaning.correct ? '✓ Doğru anlam' : '✕ Yanlış anlam'}</strong>
          {card.meaning.transcript ? <span>Cevabınız: {card.meaning.transcript}</span> : null}
          <span>Doğru anlam: {word.meanings.join(', ')}</span>
          {card.meaning.reason ? <span>{card.meaning.reason}</span> : null}
          <button className="feedback-override" type="button" onClick={() => dispatch({ type: 'OVERRIDE_MEANING' })} disabled={busy}>Karar yanlış, düzelt</button>
          {card.meaning.correct && card.meaning.isNewValidMeaning && !newMeaningAdded ? (
            <button className="secondary-button" type="button" onClick={() => void addNewMeaning()} disabled={busy}>Bu anlamı kelimeye ekle</button>
          ) : null}
          <button className="primary-button" type="button" onClick={() => void persistCard()} disabled={busy}>
            {busy ? 'Kaydediliyor…' : index === words.length - 1 ? 'Sonucu kaydet ve bitir' : 'Sonucu kaydet ve sonraki'}
          </button>
          {setup.audio.autoAdvance ? <small>2,5 saniye sonra otomatik ilerler.</small> : null}
        </div>
      ) : null}

      {notice || card.notice ? <p className="form-message form-message--error" role="status">{notice || card.notice}</p> : null}
    </section>
  );
}
