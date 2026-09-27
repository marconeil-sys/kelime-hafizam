import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  children?: ReactNode;
}

export function FeatureCard({ icon, title, description, badge, children }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <div className="feature-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="feature-card__body">
        <div className="feature-card__title-row">
          <h3>{title}</h3>
          {badge ? <span className="badge">{badge}</span> : null}
        </div>
        <p>{description}</p>
        {children}
      </div>
    </article>
  );
}

