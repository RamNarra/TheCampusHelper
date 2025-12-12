import React from 'react';
import { User, Award, Link2 } from 'lucide-react';
import metadata from '../metadata.json';

type DeveloperMeta = {
  name: string;
  headline?: string;
  highlights?: string[];
  linkedin?: string;
};

const DeveloperPage: React.FC = () => {
  const dev = (metadata as any).developer as DeveloperMeta | undefined;

  const name = dev?.name || 'Developer';
  const headline = dev?.headline || 'Built with React + Firebase + Vercel.';
  const highlights = dev?.highlights || [];
  const linkedin = dev?.linkedin || '';

  return (
    <div className="bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <User className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold">Developer</h1>
          </div>
          <p className="text-muted-foreground text-lg">{name}</p>
          <p className="text-muted-foreground mt-2">{headline}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          {highlights.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 font-semibold mb-3">
                <Award className="w-5 h-5 text-primary" />
                Highlights
              </div>
              <ul className="space-y-2">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/70" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {linkedin && (
            <div>
              <div className="flex items-center gap-2 font-semibold mb-2">
                <Link2 className="w-5 h-5 text-primary" />
                LinkedIn
              </div>
              <div className="text-muted-foreground break-all">{linkedin}</div>
              <div className="text-xs text-muted-foreground mt-2">
                (Displayed for reference — not opened automatically.)
              </div>
            </div>
          )}

          {!highlights.length && !linkedin && (
            <div className="text-muted-foreground">
              Add your details in <span className="font-semibold">metadata.json</span> under the <span className="font-semibold">developer</span> key.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeveloperPage;
