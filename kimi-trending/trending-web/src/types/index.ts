export interface GitHubTrending {
  id: number;
  repo_name: string;
  owner: string;
  full_name: string;
  description: string;
  language: string;
  stars: number;
  stars_today: number;
  forks: number;
  period: string;
  fetched_at: string;
  url: string;
  contributors: number;
}

export interface GitHubStarred {
  id: number;
  repo_name: string;
  owner: string;
  full_name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  starred_at: string;
  topics: string;
  url: string;
  private: boolean;
}

export interface ProductHunt {
  id: number;
  product_id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  thumbnail: string;
  votes_count: number;
  comments_count: number;
  makers: string;
  topics: string;
  day: string;
  featured: boolean;
}

export interface DashboardStats {
  total_trending: number;
  total_starred: number;
  total_producthunt: number;
  last_fetch_trending: string;
  last_fetch_starred: string;
  last_fetch_producthunt: string;
}

export interface ApiResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
