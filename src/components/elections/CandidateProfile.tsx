import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MemberAvatar from '@/components/members/MemberAvatar';

interface CandidateProfileProps {
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  position: number | null;
  isLeader: boolean;
  bio: string | null;
  birthYear: number | null;
  residence: string | null;
  profession: string | null;
  education: string | null;
  listName: string;
  listColor: string | null;
  labels: {
    position: string;
    leader: string;
    bio: string;
    birthYear: string;
    residence: string;
    profession: string;
    education: string;
    personalInfo: string;
  };
}

export default function CandidateProfile({
  firstName,
  lastName,
  imageUrl,
  position,
  isLeader,
  bio,
  birthYear,
  residence,
  profession,
  education,
  listName,
  listColor,
  labels,
}: CandidateProfileProps) {
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <MemberAvatar
          member={{ firstName, lastName, imageUrl }}
          size="xl"
        />
        <div>
          <h1 className="text-2xl font-bold">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              className="text-white"
              style={{ backgroundColor: listColor ?? 'hsl(var(--primary))' }}
            >
              {listName}
            </Badge>
            {position != null && (
              <span className="text-sm text-muted-foreground">
                {labels.position} #{position}
              </span>
            )}
            {isLeader && (
              <Badge variant="outline">★ {labels.leader}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.bio}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {bio}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Personal details */}
      {(birthYear || residence || profession || education) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.personalInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {profession && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">{labels.profession}</dt>
                  <dd className="text-sm">{profession}</dd>
                </div>
              )}
              {education && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">{labels.education}</dt>
                  <dd className="text-sm">{education}</dd>
                </div>
              )}
              {residence && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">{labels.residence}</dt>
                  <dd className="text-sm">{residence}</dd>
                </div>
              )}
              {birthYear && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">{labels.birthYear}</dt>
                  <dd className="text-sm">{birthYear}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
