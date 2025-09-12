import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Activity, Database, Clock, MapPin, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HealthData {
  status: string;
  timestamp: string;
  cache: {
    entries: number;
    ttl: number;
  };
}

interface ResolveRequest {
  id: string;
  identifiers: Record<string, string>;
  brand: string | null;
  title: string | null;
  platform: string;
  url: string;
  zipCode: string | null;
  success: boolean;
  createdAt: string;
  response?: any;
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthData>({
    queryKey: ['/api/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentRequests, isLoading: requestsLoading, refetch: refetchRequests } = useQuery<ResolveRequest[]>({
    queryKey: ['/api/resolve/recent'],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/cache', { method: 'DELETE' });
      if (response.ok) {
        toast({
          title: "Cache cleared",
          description: "All cached resolve responses have been cleared.",
        });
        refetchHealth();
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    refetchHealth();
    refetchRequests();
    toast({
      title: "Refreshed",
      description: "Dashboard data has been updated.",
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSuccessRate = (requests: ResolveRequest[]) => {
    if (!requests || requests.length === 0) return 0;
    const successful = requests.filter(req => req.success).length;
    return Math.round((successful / requests.length) * 100);
  };

  const getPlatformStats = (requests: ResolveRequest[]) => {
    if (!requests) return {};
    const stats: Record<string, number> = {};
    requests.forEach(req => {
      stats[req.platform] = (stats[req.platform] || 0) + 1;
    });
    return stats;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-8 w-8 text-primary" />
              LocalStock Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor real-time local product availability resolution
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="gap-2" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Current API status and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : health ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={health.status === 'ok' ? 'default' : 'destructive'} data-testid="status-badge">
                      {health.status === 'ok' ? 'Healthy' : 'Error'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatTimestamp(health.timestamp)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium" data-testid="text-cache-entries">{health.cache?.entries || 0}</span>
                    <span className="text-sm text-muted-foreground">cache entries</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    TTL: {health.cache?.ttl || 0} seconds
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Button onClick={handleClearCache} variant="outline" size="sm" data-testid="button-clear-cache">
                    Clear Cache
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-health-error">
                Failed to load health status
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Resolve Requests
            </CardTitle>
            <CardDescription>
              Latest product resolution attempts and their outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recentRequests && recentRequests.length > 0 ? (
              <div className="space-y-6">
                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="text-total-requests">
                      {recentRequests.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600" data-testid="text-success-rate">
                      {getSuccessRate(recentRequests)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">Platform Distribution</div>
                    <div className="flex gap-2 justify-center mt-1 flex-wrap">
                      {Object.entries(getPlatformStats(recentRequests)).map(([platform, count]) => (
                        <Badge key={platform} variant="outline" className="text-xs">
                          {platform}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Request List */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {recentRequests.map((request: ResolveRequest) => (
                    <div key={request.id} className="border rounded-lg p-4 space-y-3" data-testid={`request-${request.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={request.success ? 'default' : 'destructive'}>
                              {request.success ? 'Success' : 'Failed'}
                            </Badge>
                            <Badge variant="outline">{request.platform}</Badge>
                            {request.zipCode && (
                              <Badge variant="outline">ZIP: {request.zipCode}</Badge>
                            )}
                          </div>
                          <h4 className="font-medium truncate" title={request.title || 'Unknown Product'}>
                            {request.title || 'Unknown Product'}
                          </h4>
                          {request.brand && (
                            <p className="text-sm text-muted-foreground">
                              Brand: {request.brand}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                          {formatTimestamp(request.createdAt)}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                          {Object.entries(request.identifiers).map(([key, value]) => (
                            <span key={key}>
                              {key.toUpperCase()}: {value}
                            </span>
                          ))}
                        </div>
                        
                        {request.success && request.response?.offers && (
                          <div className="text-sm">
                            <span className="font-medium text-green-600">
                              {request.response.offers.length} local offer(s) found
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-requests">
                No recent requests found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extension Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Extension Integration
            </CardTitle>
            <CardDescription>
              Information about Chrome extension integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Chrome Extension Setup
                </h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <p>
                    • Load the extension in Chrome by going to <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">chrome://extensions/</code>
                  </p>
                  <p>
                    • Enable "Developer mode" and click "Load unpacked"
                  </p>
                  <p>
                    • Select the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">extension/</code> folder from this project
                  </p>
                  <p>
                    • Navigate to Amazon or Walmart product pages to see local availability
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium mb-2">Supported Platforms</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Amazon.com product pages (/dp/, /gp/product/)</li>
                    <li>• Walmart.com product pages (/ip/)</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium mb-2">Features</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Real-time product data extraction</li>
                    <li>• Local availability resolution</li>
                    <li>• Floating pill UI with offer count</li>
                    <li>• Slide-in panel with detailed offers</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
