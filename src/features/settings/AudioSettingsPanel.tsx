import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  DEFAULT_AUDIO_SETTINGS,
  getAudioSettings,
  getGeminiSettings,
  saveAudioSettings,
  type AudioSettings,
} from '../../db/settings';
import { detectDeviceCapabilities, type CapabilityReport } from '../../services/capabilities';
import { recordAudioClip } from '../../services/recorder';
import { listSpeechVoices, speakText, type VoiceOption } from '../../services/tts';

type Message = { tone: 'success' | 'error'; text: string };

function languageMatches(voice: VoiceOption, language: 'en' | 'tr'): boolean {
  return voice.lang.toLowerCase().startsWith(language);
}

function modeLabel(report: CapabilityReport): string {
  if (report.activeMode === 'webspeech') return 'Mod A — Web Speech (ücretsiz)';
  if (report.activeMode === 'gemini') return 'Mod B — ses kaydı + Gemini';
  return 'Elle değerlendirme modu';
}

export function AudioSettingsPanel() {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [report, setReport] = useState<CapabilityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const englishVoices = useMemo(() => voices.filter((voice) => languageMatches(voice, 'en')), [voices]);
  const turkishVoices = useMemo(() => voices.filter((voice) => languageMatches(voice, 'tr')), [voices]);

  useEffect(() => {
    let active = true;
    void Promise.all([getAudioSettings(), listSpeechVoices(), getGeminiSettings()]).then(([savedSettings, availableVoices, gemini]) => {
      if (!active) return;
      setSettings(savedSettings);
      setVoices(availableVoices);
      setHasGeminiKey(Boolean(gemini.apiKey));
    }).catch(() => {
      if (active) setMessage({ tone: 'error', text: 'Ses ayarları okunamadı.' });
    });
    return () => { active = false; };
  }, []);

  function update<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setReport(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveAudioSettings(settings);
      setMessage({ tone: 'success', text: 'Ses ve test tercihleri bu cihaza kaydedildi.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Ses ayarları kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleVoiceTest(language: 'en' | 'tr') {
    setBusy(true);
    setMessage(null);
    try {
      await speakText(language === 'en'
        ? { text: 'example', lang: settings.accent, voiceURI: settings.englishVoiceURI }
        : { text: 'Sesli geri bildirim hazır.', lang: 'tr-TR', voiceURI: settings.turkishVoiceURI });
      setMessage({ tone: 'success', text: language === 'en' ? 'İngilizce ses çalındı.' : 'Türkçe ses çalındı.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Ses çalınamadı.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeviceTest() {
    setBusy(true);
    setReport(null);
    setMessage(null);
    try {
      const nextReport = await detectDeviceCapabilities({
        preference: settings.pronunciationMode,
        accent: settings.accent,
        hasGeminiKey,
      });
      setReport(nextReport);
      setMessage({ tone: 'success', text: `Cihaz testi tamamlandı: ${modeLabel(nextReport)} seçildi.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Cihaz testi tamamlanamadı.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleMicrophoneTest() {
    setBusy(true);
    setRecording(true);
    setMessage({ tone: 'success', text: '2,5 saniye konuşun… Bu deneme kaydı hiçbir yere gönderilmez.' });
    try {
      const result = await recordAudioClip({ maxDurationMs: 2_500 });
      setMessage(result.isSilent
        ? { tone: 'error', text: 'Kayıt oluştu ancak yeterli ses duyulmadı. Mikrofona biraz daha yakın konuşun.' }
        : { tone: 'success', text: `Mikrofon kaydı çalışıyor (${result.mimeType}). Deneme kaydı silindi.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Mikrofon testi tamamlanamadı.' });
    } finally {
      setRecording(false);
      setBusy(false);
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="audio-settings-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Aşama 4</p>
          <h3 id="audio-settings-title">Ses, mikrofon ve test modu</h3>
        </div>
        <span className="setting-row__icon" aria-hidden="true">◖</span>
      </div>

      <form className="data-form" onSubmit={handleSave}>
        <label>
          <span>İngilizce aksanı</span>
          <select value={settings.accent} onChange={(event) => update('accent', event.target.value as AudioSettings['accent'])}>
            <option value="en-US">Amerikan İngilizcesi (en-US)</option>
            <option value="en-GB">Britanya İngilizcesi (en-GB)</option>
          </select>
        </label>
        <label>
          <span>İngilizce ses</span>
          <select value={settings.englishVoiceURI} onChange={(event) => update('englishVoiceURI', event.target.value)}>
            <option value="">Cihazın otomatik seçimi</option>
            {englishVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} — {voice.lang}</option>
            ))}
          </select>
        </label>
        <button className="filter-clear" type="button" onClick={() => void handleVoiceTest('en')} disabled={busy}>
          İngilizce sesi dene
        </button>
        <label>
          <span>Türkçe geri bildirim sesi</span>
          <select value={settings.turkishVoiceURI} onChange={(event) => update('turkishVoiceURI', event.target.value)}>
            <option value="">Cihazın otomatik seçimi</option>
            {turkishVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} — {voice.lang}</option>
            ))}
          </select>
        </label>
        <button className="filter-clear" type="button" onClick={() => void handleVoiceTest('tr')} disabled={busy}>
          Türkçe sesi dene
        </button>
        <label>
          <span>Telaffuz değerlendirme modu</span>
          <select
            value={settings.pronunciationMode}
            onChange={(event) => update('pronunciationMode', event.target.value as AudioSettings['pronunciationMode'])}
          >
            <option value="auto">Otomatik (önerilen)</option>
            <option value="webspeech">Yalnız Web Speech</option>
            <option value="gemini">Yalnız Gemini ses kaydı</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.spokenFeedback}
            onChange={(event) => update('spokenFeedback', event.target.checked)}
          />
          <span>Doğru/yanlış geri bildirimini sesli oku</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(event) => update('autoAdvance', event.target.checked)}
          />
          <span>Sonuçtan sonra otomatik sonraki karta geç</span>
        </label>
        <div className="button-row button-row--wrap">
          <button className="primary-button" type="submit" disabled={busy}>Ayarları kaydet</button>
          <button className="secondary-button" type="button" onClick={() => void handleDeviceTest()} disabled={busy}>
            Cihazı test et
          </button>
          <button className="secondary-button" type="button" onClick={() => void handleMicrophoneTest()} disabled={busy}>
            {recording ? 'Dinleniyor…' : 'Mikrofon kaydını dene'}
          </button>
        </div>
      </form>

      <p className="field-help settings-note">
        Web Speech, söylediğiniz kelimenin anlaşılır olup olmadığını ölçer; fonem düzeyinde aksan puanı vermez.
        Otomatik mod çalışmazsa uygulama Gemini ses kaydına, o da hazır değilse elle değerlendirmeye geçer.
      </p>
      {report ? (
        <div className="capability-report" aria-label="Cihaz testi sonucu">
          <strong>{modeLabel(report)}</strong>
          <span>TTS: {report.textToSpeech ? 'hazır' : 'desteklenmiyor'}</span>
          <span>Web Speech: {report.recognitionProbe.working ? 'çalışıyor' : `çalışmadı (${report.recognitionProbe.reason ?? 'bilinmeyen'})`}</span>
          <span>Ses kaydı: {report.audioRecording ? `hazır${report.audioMimeType ? ` · ${report.audioMimeType}` : ''}` : 'desteklenmiyor'}</span>
        </div>
      ) : null}
      {message ? <p className={`form-message form-message--${message.tone}`} role="status">{message.text}</p> : null}
    </section>
  );
}
