'use client';

import { useTranslations } from 'next-intl';
import { Users, Calendar, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LobbyistConnection {
  id: number;
  lobbyistName: string;
  lobbyistNumber: string | null;
  clientName: string | null;
  connectionType: string;
  eventDate: string | null;
  sourceUrl: string | null;
}

interface LobbyistConnectionsProps {
  connections: LobbyistConnection[];
  total: number;
}

export default function LobbyistConnections({ connections, total }: LobbyistConnectionsProps) {
  const t = useTranslations('integrity');

  if (connections.length === 0) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          {t('lobbyistConnections')}
          {total > 0 && (
            <Badge variant="secondary" className="ms-auto text-xs">
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-3 rounded-lg p-2.5 ring-1 ring-border/30 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{conn.lobbyistName}</p>
                {conn.clientName && (
                  <p className="text-xs text-muted-foreground">
                    {t('client')}: {conn.clientName}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {t(`connectionTypes.${conn.connectionType}`)}
                  </Badge>
                  {conn.eventDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(conn.eventDate).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </div>
              </div>
              {conn.sourceUrl && (
                <a
                  href={conn.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
