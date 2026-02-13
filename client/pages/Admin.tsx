import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  adminService,
  AdminStats,
  AdminUser,
  AdminGame,
  AdminTransaction,
  AdminNotification,
} from "@/services/adminService";
import AIEmployeeManager from "@/components/AIEmployeeManager";
import CasinoAnalytics from "@/components/CasinoAnalytics";
import CasinoBanking from "@/components/CasinoBanking";
import BankingAdmin from "@/components/BankingAdmin";
import ScratchCardAdmin from "@/components/ScratchCardAdmin";
import GoldStoreManager from "@/components/GoldStoreManager";
import BonusManagement from "@/components/BonusManagement";
import CmsManagement from "@/components/CmsManagement";
import GameManagement from "@/components/GameManagement";
import SlotsGameManagement from "@/components/SlotsGameManagement";
import AdminToolbar from "@/components/AdminToolbar";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import AdminNotificationCenter from "@/components/AdminNotificationCenter";
import BankingPaymentsAdmin from "@/components/admin/BankingPaymentsAdmin";
import PackageEditor from "@/components/admin/PackageEditor";
import Compliance from "./Compliance";
import {
  Shield,
  Users,
  Settings,
  BarChart3,
  AlertTriangle,
  Bot,
  Database,
  CreditCard,
  FileText,
  Activity,
  Search,
  Filter,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Zap,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Store,
  Coins,
  Gift,
  Layout,
  RefreshCw,
  Crown,
  Mail,
  UserCheck,
  UserX,
  GamepadIcon,
  Bell,
  Loader2,
} from "lucide-react";

export default function Admin() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check admin access
  useEffect(() => {
    if (!isLoading && (!user?.isLoggedIn || !user?.isAdmin)) {
      navigate("/");
    }
  }, [isLoading, user, navigate]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 20;

  // Load initial data
  useEffect(() => {
    loadAllData();

    // Subscribe to real-time updates
    const unsubscribeStats = adminService.subscribeToUpdates(
      "stats",
      (newStats) => {
        setStats(newStats);
      },
    );

    const unsubscribeNotifications = adminService.subscribeToUpdates(
      "notifications",
      (newNotifications) => {
        setNotifications(newNotifications);
        setUnreadCount(
          newNotifications.filter((n: AdminNotification) => !n.read_status)
            .length,
        );
      },
    );

    return () => {
      unsubscribeStats();
      unsubscribeNotifications();
    };
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [
        statsData,
        usersData,
        gamesData,
        transactionsData,
        notificationsData,
      ] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getAllUsers(currentPage, usersPerPage, searchTerm),
        adminService.getAllGames(),
        adminService.getRecentTransactions(),
        adminService.getAdminNotifications(),
      ]);

      setStats(statsData);
      setUsers(usersData.users);
      setTotalUsers(usersData.total);
      setGames(gamesData);
      setTransactions(transactionsData);
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter((n) => !n.read_status).length);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
    toast({
      title: "Data Refreshed",
      description: "All admin data has been updated.",
    });
  };

  const handleUserStatusUpdate = async (userId: number, newStatus: string) => {
    try {
      await adminService.updateUserStatus(userId, newStatus);
      await loadAllData(); // Refresh data
      toast({
        title: "User Updated",
        description: `User status updated to ${newStatus}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    }
  };

  const handleGameToggle = async (gameId: string, isActive: boolean) => {
    try {
      await adminService.updateGameStatus(gameId, isActive);
      await loadAllData(); // Refresh data
      toast({
        title: "Game Updated",
        description: `Game ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update game status.",
        variant: "destructive",
      });
    }
  };

  const handleNotificationRead = async (notificationId: number) => {
    try {
      await adminService.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read_status: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    await handleNotificationRead(parseInt(id));
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.read_status);
      await Promise.all(
        unreadNotifications.map((n) => adminService.markNotificationRead(n.id)),
      );
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_status: true })),
      );
      setUnreadCount(0);
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      // In production, call API to delete notification
      setNotifications((prev) => prev.filter((n) => n.id !== parseInt(id)));
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    // Implementation for logout
    navigate("/");
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not admin (will redirect)
  if (!user?.isLoggedIn || !user?.isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Toolbar */}
      <AdminToolbar
        unreadNotifications={unreadCount}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-casino-blue/10 via-gold/5 to-casino-blue/10 py-6 border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">CoinKrazy Admin Panel</h1>
              <p className="text-muted-foreground">
                Management Dashboard & AI Assistant
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className="border-gold-500 text-gold-400"
              >
                <Shield className="w-3 h-3 mr-1" />
                Admin: {user?.email}
              </Badge>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-green-500/10 border-green-500 text-green-400"
              >
                {refreshing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh Data
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="bg-red-500/10 border-red-500 text-red-400"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Live Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-casino-blue/10 to-casino-blue/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">
                      {stats.totalUsers.toLocaleString()}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-casino-blue" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Now</p>
                    <p className="text-2xl font-bold">
                      {stats.activeNow.toLocaleString()}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending KYC</p>
                    <p className="text-2xl font-bold">{stats.pendingKyc}</p>
                  </div>
                  <FileText className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gold-500/10 to-gold-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue 24h</p>
                    <p className="text-2xl font-bold">
                      ${stats.revenue24h.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-gold-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Withdrawals</p>
                    <p className="text-2xl font-bold">
                      {stats.pendingWithdrawals}
                    </p>
                  </div>
                  <CreditCard className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      System Health
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.systemHealth.toFixed(1)}%
                    </p>
                  </div>
                  <Database className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Alerts</p>
                    <p className="text-2xl font-bold">{stats.fraudAlerts}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin Tools Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto p-1">
            <TabsTrigger
              value="dashboard"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Dash</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Users className="w-4 h-4 mr-1 sm:mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <GamepadIcon className="w-4 h-4 mr-1 sm:mr-2" />
              Games
            </TabsTrigger>
            <TabsTrigger
              value="game-management"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Settings className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Game Mgmt</span>
              <span className="lg:hidden">Mgmt</span>
            </TabsTrigger>
            <TabsTrigger
              value="slots-management"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Coins className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Slots Mgmt</span>
              <span className="lg:hidden">Slots</span>
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <CreditCard className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Transactions</span>
              <span className="lg:hidden">Trans</span>
            </TabsTrigger>
            <TabsTrigger
              value="banking"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <CreditCard className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Banking</span>
              <span className="lg:hidden">Bank</span>
            </TabsTrigger>
            <TabsTrigger
              value="scratch-cards"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Gift className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Scratch Cards</span>
              <span className="lg:hidden">Scratch</span>
            </TabsTrigger>
            <TabsTrigger
              value="ai-manager"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Bot className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">AI Manager</span>
              <span className="lg:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger
              value="store"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Store className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Gold Store</span>
              <span className="lg:hidden">Store</span>
            </TabsTrigger>
            <TabsTrigger
              value="bonus"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Gift className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Bonuses</span>
              <span className="lg:hidden">Bonus</span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Analytics</span>
              <span className="lg:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger
              value="cms"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Layout className="w-4 h-4 mr-1 sm:mr-2" />
              CMS
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Bell className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Notifications</span>
              <span className="lg:hidden">Notif</span>
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 h-4 w-4 text-xs p-0 flex items-center justify-center"
                >
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="compliance"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Shield className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Compliance</span>
              <span className="lg:hidden">Legal</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              <Settings className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden lg:inline">Settings</span>
              <span className="lg:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Overview */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{transaction.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {transaction.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {transaction.amount} {transaction.currency}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {transaction.transaction_type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Database Connection</span>
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Healthy
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Games</span>
                      <span className="font-bold">
                        {stats?.activeGames || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Currency in Circulation</span>
                      <div className="text-right">
                        <p className="font-bold">
                          {(stats?.totalGC || 0).toLocaleString()} GC
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(stats?.totalSC || 0).toFixed(2)} SC
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>User Management</CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">KYC</th>
                        <th className="text-left p-2">GC Balance</th>
                        <th className="text-left p-2">SC Balance</th>
                        <th className="text-left p-2">Last Login</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-border/50 hover:bg-muted/50"
                        >
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{user.username}</div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                              {user.role === "admin" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs mt-1"
                                >
                                  <Crown className="w-3 h-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                user.status === "active"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {user.status}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                user.kyc_status === "verified"
                                  ? "default"
                                  : user.kyc_status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {user.kyc_status}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono">
                            {(user.gold_coins / 1000).toLocaleString()}
                          </td>
                          <td className="p-2 font-mono text-gold-400">
                            {parseFloat(user.sweeps_coins).toFixed(2)}
                          </td>
                          <td className="p-2 text-sm">
                            {user.last_login
                              ? new Date(user.last_login).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Edit className="w-3 h-3" />
                              </Button>
                              {user.status === "active" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500"
                                  onClick={() =>
                                    handleUserStatusUpdate(user.id, "suspended")
                                  }
                                >
                                  <Ban className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-500"
                                  onClick={() =>
                                    handleUserStatusUpdate(user.id, "active")
                                  }
                                >
                                  <UserCheck className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Game Management */}
          <TabsContent value="games" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Game Management & RTP Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2">Game</th>
                        <th className="text-left p-2">Provider</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">RTP</th>
                        <th className="text-left p-2">Players</th>
                        <th className="text-left p-2">Profit</th>
                        <th className="text-left p-2">Jackpot (45%)</th>
                        <th className="text-left p-2">Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.map((game) => (
                        <tr
                          key={game.id}
                          className="border-b border-border/50 hover:bg-muted/50"
                        >
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{game.name}</div>
                              {game.is_featured && (
                                <Badge
                                  variant="outline"
                                  className="text-xs mt-1"
                                >
                                  Featured
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {game.provider}
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={game.is_active ? "default" : "secondary"}
                            >
                              {game.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono">{game.rtp}%</td>
                          <td className="p-2">{game.total_players}</td>
                          <td className="p-2">
                            <div className="text-sm">
                              <div className="text-gold-400">
                                {(game.total_profit_gc / 1000).toLocaleString()}{" "}
                                GC
                              </div>
                              <div className="text-casino-blue">
                                {parseFloat(game.total_profit_sc).toFixed(2)} SC
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-sm">
                              <div className="text-gold-400 font-bold">
                                {(
                                  game.current_jackpot_calculated / 1000
                                ).toLocaleString()}{" "}
                                GC
                              </div>
                              <div className="text-casino-blue font-bold">
                                {parseFloat(
                                  game.current_jackpot_sc_calculated,
                                ).toFixed(2)}{" "}
                                SC
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={game.is_active ? "outline" : "default"}
                                className={
                                  game.is_active
                                    ? "text-orange-500"
                                    : "bg-green-500 hover:bg-green-600"
                                }
                                onClick={() =>
                                  handleGameToggle(
                                    game.game_id,
                                    !game.is_active,
                                  )
                                }
                              >
                                {game.is_active ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </Button>
                              <Button size="sm" variant="outline">
                                <Settings className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <BarChart3 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Game Management - SlotsAI Integration */}
          <TabsContent value="game-management" className="mt-6">
            <GameManagement />
          </TabsContent>

          {/* Slots Management */}
          <TabsContent value="slots-management" className="mt-6">
            <SlotsGameManagement />
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Amount</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b border-border/50 hover:bg-muted/50"
                        >
                          <td className="p-2">
                            <div>
                              <div className="font-medium">
                                {transaction.username}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {transaction.email}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 capitalize">
                            {transaction.transaction_type}
                          </td>
                          <td className="p-2 font-mono">
                            {transaction.amount} {transaction.currency}
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                transaction.status === "completed"
                                  ? "default"
                                  : transaction.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {transaction.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-sm">
                            {new Date(transaction.created_at).toLocaleString()}
                          </td>
                          <td className="p-2 text-sm">
                            {transaction.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banking Administration */}
          <TabsContent value="banking" className="mt-6">
            <BankingPaymentsAdmin />
          </TabsContent>

          {/* Scratch Cards Administration */}
          <TabsContent value="scratch-cards" className="mt-6">
            <ScratchCardAdmin />
          </TabsContent>

          {/* Enhanced Notifications */}
          <TabsContent value="notifications" className="mt-6">
            <AdminNotificationCenter
              notifications={notifications.map((n) => ({
                id: n.id.toString(),
                type:
                  n.notification_type === "error"
                    ? "security"
                    : n.notification_type === "warning"
                      ? "system"
                      : n.notification_type === "info"
                        ? "general"
                        : "general",
                priority:
                  n.notification_type === "error"
                    ? "high"
                    : n.notification_type === "warning"
                      ? "medium"
                      : "low",
                title: n.title,
                message: n.message,
                timestamp: new Date(n.created_at),
                read: n.read_status,
                actionable: false,
                user_id: n.admin_user_id,
                metadata: { ai_name: n.ai_name },
              }))}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onDeleteNotification={handleDeleteNotification}
              onRefresh={handleRefresh}
              isRefreshing={refreshing}
            />
          </TabsContent>

          {/* AI Employee Manager */}
          <TabsContent value="ai-manager" className="mt-6">
            <AIEmployeeManager />
          </TabsContent>

          {/* Gold Coin Store Management */}
          <TabsContent value="store" className="mt-6">
            <PackageEditor />
          </TabsContent>

          {/* Bonus Management */}
          <TabsContent value="bonus" className="mt-6">
            <BonusManagement />
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="mt-6">
            <CasinoAnalytics />
          </TabsContent>

          {/* CMS Management */}
          <TabsContent value="cms" className="mt-6">
            <CmsManagement />
          </TabsContent>

          {/* Compliance */}
          <TabsContent value="compliance" className="mt-6">
            <Compliance />
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-6">
            <AdminSettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
