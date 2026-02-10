export type MobileToken = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserRead = {
  id: number;
  name: string;
  username: string;
  email: string;
  profile_image_url: string;
  tier_id: number | null;
};

export type UserCreate = {
  name: string;
  username: string;
  email: string;
  password: string;
};

