import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  Gavel,
  TrendingUp,
  IndianRupee,
  Plus,
  Activity,
  CheckCircle,
  UserPlus,
  Timer,
  Receipt
} from 'lucide-react';
import { useLegalData } from '@/contexts/LegalDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/api';

interface DashboardStats {
  totalCases: number;
  activeCases: number;
  todaysCases: number;
  urgentCases: number;
  totalClients: number;
  revenue: {
    currentMonth: number;
    growth: string;
    invoiced: number;
    billable: number;
    billableHours: number;
  };
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  metadata: any;
}

const Dashboard = () => {
  const { cases, clients, alerts } = useLegalData();
  const { user } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [statsRes, activityRes] = await Promise.all([
          fetch(getApiUrl('/api/dashboard/stats'), { credentials: 'include' }),
          fetch(getApiUrl('/api/dashboard/activity'), { credentials: 'include' })
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setDashboardStats(stats);
        }

        if (activityRes.ok) {
          const activity = await activityRes.json();
          setRecentActivity(activity);
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const todaysCases = cases.filter(c => {
    const today = new Date();
    const caseDate = new Date(c.hearingDate);
    return caseDate.toDateString() === today.toDateString();
  });

  const urgentCases = cases.filter(c => c.priority === 'urgent');
  const activeCases = cases.filter(c => c.status === 'active');
  const unreadAlerts = alerts.filter(a => !a.isRead);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'case_created':
      case 'case_updated':
        return <FileText className="h-3 w-3" />;
      case 'client_registered':
        return <UserPlus className="h-3 w-3" />;
      case 'payment_received':
        return <Receipt className="h-3 w-3" />;
      case 'invoice_created':
        return <IndianRupee className="h-3 w-3" />;
      case 'time_logged':
        return <Timer className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'case_created':
        return 'bg-success';
      case 'case_updated':
        return 'bg-primary';
      case 'client_registered':
        return 'bg-warning';
      case 'payment_received':
        return 'bg-success';
      case 'invoice_created':
        return 'bg-secondary';
      case 'time_logged':
        return 'bg-info';
      default:
        return 'bg-muted-foreground';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }
  };

  const stats = [
    {
      title: "Total Cases",
      value: dashboardStats?.totalCases ?? cases.length,
      description: `${dashboardStats?.activeCases ?? activeCases.length} active`,
      icon: FileText,
      trend: undefined
    },
    {
      title: "Clients",
      value: dashboardStats?.totalClients ?? clients.length,
      description: "Total registered",
      icon: Users,
      trend: undefined
    },
    {
      title: "Today's Hearings",
      value: dashboardStats?.todaysCases ?? todaysCases.length,
      description: "Scheduled for today",
      icon: Calendar,
      trend: (dashboardStats?.urgentCases ?? urgentCases.length) > 0 ? `${dashboardStats?.urgentCases ?? urgentCases.length} urgent` : "No urgent cases"
    },
    {
      title: "Revenue This Month",
      value: dashboardStats?.revenue ? formatCurrency(dashboardStats.revenue.currentMonth) : "₹0",
      description: dashboardStats?.revenue && dashboardStats.revenue.billableHours > 0
        ? `${dashboardStats.revenue.billableHours.toFixed(1)} billable hours`
        : "Billing & payments",
      icon: IndianRupee,
      trend: dashboardStats?.revenue && dashboardStats.revenue.growth !== undefined
        ? `${parseFloat(dashboardStats.revenue.growth) >= 0 ? '+' : ''}${dashboardStats.revenue.growth}% from last month`
        : undefined
    }
  ];

  const quickActions = [
    {
      title: "Add New Case",
      description: "Register a new legal case",
      icon: FileText,
      action: () => navigate('/dashboard/cases'),
      color: "bg-primary"
    },
    {
      title: "Schedule Hearing",
      description: "Add court appearance",
      icon: Calendar,
      action: () => navigate('/dashboard/calendar'),
      color: "bg-secondary"
    },
    {
      title: "Add Client",
      description: "Register new client",
      icon: Users,
      action: () => navigate('/dashboard/clients'),
      color: "bg-accent"
    },
    {
      title: "Legal Research",
      description: "Search law database",
      icon: Gavel,
      action: () => navigate('/dashboard/legal-research'),
      color: "bg-warning"
    }
  ];

  return (
    <div className="space-y-2 md:space-y-3">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Here's what's happening with your practice today
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            onClick={() => navigate('/dashboard/cases')}
            className="flex-1 sm:flex-initial h-8 text-xs border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
            size="sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Case
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/clients')}
            className="flex-1 sm:flex-initial h-8 text-xs border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
            size="sm"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="card-gradient shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-xl font-bold text-primary">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground">{stat.description}</p>
              {stat.trend && (
                <div className="flex items-center pt-0.5">
                  <TrendingUp className="h-2.5 w-2.5 text-success mr-0.5" />
                  <span className="text-[10px] text-success">{stat.trend}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 md:gap-3">
        {/* Today's Cases */}
        <div className="lg:col-span-8">
          <Card className="card-gradient shadow-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                Today's Hearings ({todaysCases.length})
              </CardTitle>
              <CardDescription className="text-[10px]">Cases scheduled for today</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {todaysCases.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-xs">
                    No hearings scheduled for today
                  </p>
                ) : (
                  todaysCases.map((case_item) => (
                    <div key={case_item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-muted/20 rounded-lg border">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
                          <span className="font-medium text-xs">{case_item.caseNumber}</span>
                          <Badge
                            variant={case_item.priority === 'urgent' ? 'destructive' : 'secondary'}
                            className="w-fit text-[10px] h-4 px-1"
                          >
                            {case_item.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{case_item.clientName} vs {case_item.opposingParty}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {case_item.courtName} • {case_item.hearingTime}
                        </p>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 sm:mt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/dashboard/cases')}
                          className="h-7 text-[10px] px-2 border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => navigate('/dashboard/calendar')}
                          className="h-7 text-[10px] px-2 border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {todaysCases.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    className="w-full h-7 text-xs border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                    size="sm"
                    onClick={() => navigate('/dashboard/calendar')}
                  >
                    View Full Calendar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-2 md:space-y-3">
          {/* Quick Actions */}
          <Card className="card-gradient shadow-elevated">
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-[10px]">Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="pt-1.5">
              <div className="grid grid-cols-2 gap-1">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="flex flex-col items-center justify-center gap-1 p-1.5 h-auto text-center border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all group"
                    onClick={action.action}
                  >
                    <div className={`p-1 rounded-lg ${action.color} text-white`}>
                      <action.icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <p className="font-medium text-[11px] truncate">{action.title}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{action.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="card-gradient shadow-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-[10px]">Latest updates</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2">
                      <div className={`p-1 rounded-full ${getActivityColor(activity.type)} text-white mt-0.5 flex-shrink-0`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium break-words">{activity.message}</p>
                        <p className="text-[10px] text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
                        {activity.metadata && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {activity.type === 'payment_received' && (
                              <span>Amount: {formatCurrency(activity.metadata.amount)}</span>
                            )}
                            {activity.type === 'time_logged' && (
                              <span>{activity.metadata.durationText || `${activity.metadata.duration}m`} • {activity.metadata.billable ? 'Billable' : 'Non-billable'}</span>
                            )}
                            {(activity.type === 'case_created' || activity.type === 'case_updated') && (
                              <span>Priority: {activity.metadata.priority}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Activity className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                    <p className="text-xs">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;