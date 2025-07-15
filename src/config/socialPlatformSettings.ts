export interface PlatformSettings {
  basicFields: string[];
  apiFields?: string[];
  capabilities: string[];
  rateLimits: {
    posts_per_hour?: number;
    posts_per_day?: number;
    api_requests_per_hour?: number;
  };
  contentLimits: {
    max_text_length?: number;
    max_hashtags?: number;
    image_max_size_mb?: number;
    video_max_size_mb?: number;
    max_images_per_post?: number;
    video_max_duration_seconds?: number;
  };
  features: string[];
  oauth?: boolean;
  requiresPageId?: boolean;
}

export const platformSettings: Record<string, PlatformSettings> = {
  facebook: {
    basicFields: ['account_name', 'username'],
    apiFields: ['app_id', 'page_id'],
    capabilities: ['can_post_text', 'can_post_images', 'can_post_videos', 'can_schedule_posts', 'can_delete_posts', 'can_edit_posts'],
    rateLimits: {
      posts_per_hour: 10,
      posts_per_day: 50,
      api_requests_per_hour: 200
    },
    contentLimits: {
      max_text_length: 63206,
      max_hashtags: 30,
      image_max_size_mb: 10,
      video_max_size_mb: 4000,
      max_images_per_post: 10,
      video_max_duration_seconds: 7200
    },
    features: ['supports_stories', 'supports_polls', 'supports_link_preview', 'supports_mentions', 'supports_hashtags', 'supports_analytics', 'supports_scheduling'],
    requiresPageId: true
  },
  instagram: {
    basicFields: ['account_name', 'username'],
    apiFields: ['app_id', 'account_id'],
    capabilities: ['can_post_images', 'can_post_videos', 'can_post_text'],
    rateLimits: {
      posts_per_hour: 5,
      posts_per_day: 25,
      api_requests_per_hour: 200
    },
    contentLimits: {
      max_text_length: 2200,
      max_hashtags: 30,
      image_max_size_mb: 8,
      video_max_size_mb: 100,
      max_images_per_post: 10,
      video_max_duration_seconds: 60
    },
    features: ['supports_stories', 'supports_hashtags', 'supports_mentions', 'supports_link_preview']
  },
  twitter: {
    basicFields: ['account_name', 'username'],
    apiFields: ['client_id', 'client_secret'],
    capabilities: ['can_post_text', 'can_post_images', 'can_post_videos', 'can_delete_posts', 'can_schedule_posts'],
    rateLimits: {
      posts_per_hour: 50,
      posts_per_day: 2400,
      api_requests_per_hour: 300
    },
    contentLimits: {
      max_text_length: 280,
      max_hashtags: 10,
      image_max_size_mb: 5,
      video_max_size_mb: 512,
      max_images_per_post: 4,
      video_max_duration_seconds: 140
    },
    features: ['supports_polls', 'supports_hashtags', 'supports_mentions', 'supports_analytics', 'supports_scheduling']
  },
  linkedin: {
    basicFields: ['account_name', 'profile_url'],
    apiFields: ['client_id', 'client_secret'],
    capabilities: ['can_post_text', 'can_post_images', 'can_post_videos', 'can_edit_posts', 'can_delete_posts'],
    rateLimits: {
      posts_per_hour: 10,
      posts_per_day: 100,
      api_requests_per_hour: 1000
    },
    contentLimits: {
      max_text_length: 3000,
      max_hashtags: 30,
      image_max_size_mb: 10,
      video_max_size_mb: 5000,
      max_images_per_post: 9,
      video_max_duration_seconds: 600
    },
    features: ['supports_hashtags', 'supports_mentions', 'supports_analytics', 'supports_link_preview']
  },
  youtube: {
    basicFields: ['account_name', 'channel_url'],
    apiFields: ['client_id', 'client_secret', 'channel_id'],
    capabilities: ['can_post_videos', 'can_post_text', 'can_schedule_posts', 'can_edit_posts', 'can_delete_posts'],
    rateLimits: {
      posts_per_hour: 5,
      posts_per_day: 50,
      api_requests_per_hour: 10000
    },
    contentLimits: {
      max_text_length: 5000,
      max_hashtags: 15,
      video_max_size_mb: 128000,
      video_max_duration_seconds: 43200
    },
    features: ['supports_polls', 'supports_hashtags', 'supports_analytics', 'supports_scheduling', 'supports_link_preview']
  },
  tiktok: {
    basicFields: ['account_name', 'username'],
    apiFields: ['client_id', 'client_secret'],
    capabilities: ['can_post_videos', 'can_post_text'],
    rateLimits: {
      posts_per_hour: 5,
      posts_per_day: 20,
      api_requests_per_hour: 100
    },
    contentLimits: {
      max_text_length: 2200,
      max_hashtags: 100,
      video_max_size_mb: 287,
      video_max_duration_seconds: 600
    },
    features: ['supports_hashtags', 'supports_mentions', 'supports_analytics']
  },
  gmail: {
    basicFields: ['account_name'],
    capabilities: ['can_post_text'],
    rateLimits: {
      posts_per_hour: 100,
      posts_per_day: 2000
    },
    contentLimits: {
      max_text_length: 10000
    },
    features: ['supports_scheduling'],
    oauth: true
  },
  whatsapp_business: {
    basicFields: ['account_name', 'username'],
    apiFields: ['app_id', 'access_token'],
    capabilities: ['can_post_text', 'can_post_images', 'can_post_videos'],
    rateLimits: {
      posts_per_hour: 80,
      posts_per_day: 1000,
      api_requests_per_hour: 200
    },
    contentLimits: {
      max_text_length: 4096,
      max_hashtags: 0,
      image_max_size_mb: 5,
      video_max_size_mb: 16,
      max_images_per_post: 1,
      video_max_duration_seconds: 60
    },
    features: ['supports_link_preview', 'supports_mentions']
  }
};

export const getPlatformDefaults = (platform: string): Partial<any> => {
  const settings = platformSettings[platform];
  if (!settings) return {};

  return {
    // Set default capabilities
    can_post_text: settings.capabilities.includes('can_post_text'),
    can_post_images: settings.capabilities.includes('can_post_images'),
    can_post_videos: settings.capabilities.includes('can_post_videos'),
    can_schedule_posts: settings.capabilities.includes('can_schedule_posts'),
    can_delete_posts: settings.capabilities.includes('can_delete_posts'),
    can_edit_posts: settings.capabilities.includes('can_edit_posts'),
    can_reply_comments: settings.capabilities.includes('can_reply_comments'),
    can_moderate_comments: settings.capabilities.includes('can_moderate_comments'),
    
    // Set rate limits
    rate_limit_posts_per_hour: settings.rateLimits.posts_per_hour || 0,
    rate_limit_posts_per_day: settings.rateLimits.posts_per_day || 0,
    rate_limit_requests_per_hour: settings.rateLimits.api_requests_per_hour || 0,
    
    // Set content limits
    max_text_length: settings.contentLimits.max_text_length || 0,
    max_hashtags: settings.contentLimits.max_hashtags || 0,
    image_max_size_mb: settings.contentLimits.image_max_size_mb || 0,
    video_max_size_mb: settings.contentLimits.video_max_size_mb || 0,
    max_images_per_post: settings.contentLimits.max_images_per_post || 0,
    video_max_duration_seconds: settings.contentLimits.video_max_duration_seconds || 0,
    
    // Set features
    supports_stories: settings.features.includes('supports_stories'),
    supports_polls: settings.features.includes('supports_polls'),
    supports_link_preview: settings.features.includes('supports_link_preview'),
    supports_mentions: settings.features.includes('supports_mentions'),
    supports_hashtags: settings.features.includes('supports_hashtags'),
    supports_analytics: settings.features.includes('supports_analytics'),
    supports_scheduling: settings.features.includes('supports_scheduling')
  };
};