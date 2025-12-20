import React from 'react';
import { User, Award, Link2, Briefcase, HeartHandshake, Quote } from 'lucide-react';
import metadata from '../metadata.json';

type DeveloperMeta = {
  name: string;
  headline?: string;
  highlights?: string[];
  about?: string;
  links?: {
    linkedin?: string;
  };
  experience?: Array<{
    title: string;
    organization: string;
    type?: string;
    location?: string;
    start?: string;
    end?: string;
    bullets?: string[];
  }>;
  projects?: Array<{
    name: string;
    start?: string;
    end?: string;
    description?: string;
    tagline?: string;
  }>;
  volunteering?: Array<{
    role: string;
    organization: string;
    category?: string;
    bullets?: string[];
  }>;
  recommendations?: Array<{
    from: string;
    relationship?: string;
    date?: string;
    text: string;
  }>;
};

const DeveloperPage: React.FC = () => {
  const dev = (metadata as any).developer as DeveloperMeta | undefined;

  const name = dev?.name || 'Developer';
  const headline = dev?.headline || 'Product engineering · React · Firebase · Vercel';
  const highlights = dev?.highlights || [];
  const linkedin = dev?.links?.linkedin || (dev as any)?.linkedin || '';
  const about = dev?.about || '';
  const experience = dev?.experience || [];
  const projects = dev?.projects || [];
  const volunteering = dev?.volunteering || [];
  const recommendations = dev?.recommendations || [];

  const Card: React.FC<{ title: string; icon: React.ComponentType<any>; children: React.ReactNode }> = ({
    title,
    icon: Icon,
    children,
  }) => (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 font-semibold mb-3">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <div className="bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Developer</div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2">{name}</h1>
            <p className="text-muted-foreground mt-2">{headline}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {about ? (
            <Card title="About" icon={User}>
              <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{about}</div>
            </Card>
          ) : null}

          {highlights.length > 0 ? (
            <Card title="Highlights" icon={Award}>
              <ul className="space-y-2">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/70" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {experience.length > 0 ? (
            <Card title="Experience" icon={Briefcase}>
              <div className="space-y-4">
                {experience.map((e, idx) => (
                  <div key={`${e.organization}-${e.title}-${idx}`} className="border border-border/60 rounded-lg p-4 bg-background/40">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                      <div className="font-semibold">
                        {e.title} <span className="text-muted-foreground font-normal">· {e.organization}</span>
                      </div>
                      {(e.start || e.end) ? (
                        <div className="text-xs text-muted-foreground">{[e.start, e.end].filter(Boolean).join(' - ')}</div>
                      ) : null}
                    </div>
                    {(e.type || e.location) ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {[e.type, e.location].filter(Boolean).join(' · ')}
                      </div>
                    ) : null}
                    {e.bullets?.length ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {e.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/60" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {projects.length > 0 ? (
            <Card title="Projects" icon={Award}>
              <div className="space-y-3">
                {projects.map((p, idx) => (
                  <div key={`${p.name}-${idx}`} className="border border-border/60 rounded-lg p-4 bg-background/40">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                      <div className="font-semibold">{p.name}</div>
                      {(p.start || p.end) ? (
                        <div className="text-xs text-muted-foreground">{[p.start, p.end].filter(Boolean).join(' - ')}</div>
                      ) : null}
                    </div>
                    {p.tagline ? <div className="text-sm text-muted-foreground mt-1">{p.tagline}</div> : null}
                    {p.description ? <div className="text-sm text-muted-foreground mt-2">{p.description}</div> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {volunteering.length > 0 ? (
            <Card title="Volunteering" icon={HeartHandshake}>
              <div className="space-y-4">
                {volunteering.map((v, idx) => (
                  <div key={`${v.organization}-${v.role}-${idx}`} className="border border-border/60 rounded-lg p-4 bg-background/40">
                    <div className="font-semibold">
                      {v.role} <span className="text-muted-foreground font-normal">· {v.organization}</span>
                    </div>
                    {v.category ? <div className="text-xs text-muted-foreground mt-1">{v.category}</div> : null}
                    {v.bullets?.length ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {v.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/60" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {recommendations.length > 0 ? (
            <Card title="Recommendations" icon={Quote}>
              <div className="space-y-4">
                {recommendations.map((r, idx) => (
                  <div key={`${r.from}-${idx}`} className="border border-border/60 rounded-lg p-4 bg-background/40">
                    <div className="font-semibold">{r.from}</div>
                    {(r.relationship || r.date) ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {[r.relationship, r.date].filter(Boolean).join(' · ')}
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{r.text}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {linkedin ? (
            <Card title="LinkedIn" icon={Link2}>
              <div className="text-muted-foreground break-all">{linkedin}</div>
              <div className="text-xs text-muted-foreground mt-2">Displayed for reference.</div>
            </Card>
          ) : null}

          {!highlights.length && !linkedin && !about && !experience.length && !projects.length && !volunteering.length && !recommendations.length ? (
            <div className="bg-card border border-border rounded-xl p-6 text-muted-foreground">
              Add your details in <span className="font-semibold">metadata.json</span> under <span className="font-semibold">developer</span>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DeveloperPage;
