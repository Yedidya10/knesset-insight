import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CandidateCivicRecordProps {
  civicActivity: string | null;
  publicStatements: string | null;
  integrityNotes: string | null;
  financialDisclosure: string | null;
  conflictsOfInterest: string | null;
  platformUrl: string | null;
  labels: {
    civicActivity: string;
    publicStatements: string;
    integrity: string;
    integrityNotes: string;
    financialDisclosure: string;
    conflictsOfInterest: string;
    platform: string;
    viewPlatform: string;
  };
}

export default function CandidateCivicRecord({
  civicActivity,
  publicStatements,
  integrityNotes,
  financialDisclosure,
  conflictsOfInterest,
  platformUrl,
  labels,
}: CandidateCivicRecordProps) {
  const hasIntegrity = integrityNotes || financialDisclosure || conflictsOfInterest;
  const hasAnything = civicActivity || publicStatements || hasIntegrity || platformUrl;

  if (!hasAnything) return null;

  return (
    <div className="space-y-4">
      {civicActivity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.civicActivity}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {civicActivity}
            </p>
          </CardContent>
        </Card>
      )}

      {publicStatements && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.publicStatements}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {publicStatements}
            </p>
          </CardContent>
        </Card>
      )}

      {hasIntegrity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.integrity}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrityNotes && (
              <Section title={labels.integrityNotes} text={integrityNotes} />
            )}
            {financialDisclosure && (
              <Section title={labels.financialDisclosure} text={financialDisclosure} />
            )}
            {conflictsOfInterest && (
              <Section title={labels.conflictsOfInterest} text={conflictsOfInterest} />
            )}
          </CardContent>
        </Card>
      )}

      {platformUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.platform}</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {labels.viewPlatform} ↗
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium">{title}</h4>
      <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
