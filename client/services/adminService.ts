// Admin service for accessing admin-only API endpoints
import { authService } from "./authService";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  status: string;
  kyc_status: string;
  gold_coins?: number;
  sweeps_coins?: number;
  created_at: string;
  last_login?: string;
  role: string;
  first_name?: string;
  last_name?: string;
  is_email_verified?: boolean;
}

export interface AdminTransaction {
  id: number;
  user_id?: number;
  username?: string;
  email?: string;
  transaction_type: string;
  currency: string;
  amount: number;
  status: string;
  created_at: string;
  description?: string;
  payment_method?: string;
}

export interface AdminGame {
  id: number;
  game_id?: string;
  name: string;
  provider?: string;
  category?: string;
  rtp?: number;
  is_active: boolean;
  is_featured?: boolean;
  total_profit_gc?: number;
  total_profit_sc?: number;
  current_jackpot_calculated?: number;
  current_jackpot_sc_calculated?: number;
  total_plays?: number;
  total_players?: number;
}

export interface AdminStats {
  totalUsers?: number;
  activeNow?: number;
  pendingKyc?: number;
  revenue24h?: number;
  pendingWithdrawals?: number;
  systemHealth?: number;
  fraudAlerts?: number;
  totalGC?: number;
  totalSC?: number;
  activeGames?: number;
  [key: string]: any;
}

export interface AdminNotification {
  id: number;
  title: string;
  message: string;
  notification_type?: string;
  type?: string;
  priority?: number;
  from_ai_employee?: number;
  admin_user_id?: number;
  ai_name?: string;
  read_status?: boolean;
  read?: boolean;
  action_required?: boolean;
  action_url?: string;
  created_at: string;
}

interface UpdateUserStatusRequest {
  newStatus: "active" | "suspended" | "banned" | "pending_verification";
}

interface ToggleGameRequest {
  isActive: boolean;
}

class AdminService {
  private static instance: AdminService;
  private baseUrl = "/api";

  static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  private checkAdminAccess(): void {
    if (!authService.isAdmin()) {
      throw new Error("Unauthorized: Admin access required");
    }
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("coinkrazy_token") || "";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      if (response.status === 401 || response.status === 403) {
        authService.logout();
        throw new Error("Admin access denied. Please log in again.");
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getDashboardStats(): Promise<AdminStats> {
    this.checkAdminAccess();
    try {
      return await this.apiCall("/admin/stats");
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      throw error;
    }
  }

  async getAllUsers(
    page: number = 1,
    limit: number = 50,
    search?: string
  ): Promise<{ users: AdminUser[]; total: number }> {
    this.checkAdminAccess();
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
      if (search) params.append("search", search);
      
      const users = await this.apiCall<AdminUser[]>(
        `/admin/users?${params.toString()}`
      );
      return { users: Array.isArray(users) ? users : [], total: users?.length || 0 };
    } catch (error) {
      console.error("Failed to fetch users:", error);
      throw error;
    }
  }

  async getAllGames(): Promise<AdminGame[]> {
    this.checkAdminAccess();
    try {
      return await this.apiCall("/games");
    } catch (error) {
      console.error("Failed to fetch games:", error);
      throw error;
    }
  }

  async getRecentTransactions(limit: number = 50): Promise<AdminTransaction[]> {
    this.checkAdminAccess();
    try {
      return await this.apiCall(
        `/admin/transactions?limit=${limit}`
      );
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      throw error;
    }
  }

  async getAdminNotifications(): Promise<AdminNotification[]> {
    this.checkAdminAccess();
    try {
      return await this.apiCall("/notifications/unread");
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      throw error;
    }
  }

  async updateUserStatus(
    userId: number,
    newStatus: string
  ): Promise<AdminUser> {
    this.checkAdminAccess();
    try {
      return await this.apiCall(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error(`Failed to update user ${userId} status:`, error);
      throw error;
    }
  }

  async updateGameStatus(gameId: number, isActive: boolean): Promise<AdminGame> {
    this.checkAdminAccess();
    try {
      return await this.apiCall(`/games/${gameId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
    } catch (error) {
      console.error(`Failed to update game ${gameId} status:`, error);
      throw error;
    }
  }

  async markNotificationRead(notificationId: number): Promise<AdminNotification> {
    this.checkAdminAccess();
    try {
      return await this.apiCall(`/notifications/${notificationId}/read`, {
        method: "POST",
      });
    } catch (error) {
      console.error(`Failed to mark notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  async updateUserBalance(
    userId: number,
    goldCoins: number,
    sweepsCoins: number,
    description: string
  ): Promise<any> {
    this.checkAdminAccess();
    try {
      return await this.apiCall(`/balances/${userId}/update`, {
        method: "POST",
        body: JSON.stringify({
          gold_coins: goldCoins,
          sweeps_coins: sweepsCoins,
          description,
        }),
      });
    } catch (error) {
      console.error(`Failed to update user ${userId} balance:`, error);
      throw error;
    }
  }

  // Fallback subscription system for real-time updates
  private updateSubscribers: Map<
    string,
    ((data: any) => void)[]
  > = new Map();

  subscribeToUpdates(
    channel: string,
    callback: (data: any) => void
  ): () => void {
    if (!this.updateSubscribers.has(channel)) {
      this.updateSubscribers.set(channel, []);
    }
    this.updateSubscribers.get(channel)!.push(callback);

    // Poll for updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        if (channel === "stats") {
          const stats = await this.getDashboardStats();
          callback(stats);
        } else if (channel === "notifications") {
          const notifications = await this.getAdminNotifications();
          callback(notifications);
        }
      } catch (error) {
        console.error(`Failed to fetch ${channel} updates:`, error);
      }
    }, 5000);

    // Return unsubscribe function
    return () => {
      clearInterval(interval);
      const callbacks = this.updateSubscribers.get(channel) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }
}

export const adminService = AdminService.getInstance();
