export type User = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type RequestTraceMeta = {
  httpMethod: string;
  httpRoute: string;
  forceSlow?: boolean;
  forceDbError?: boolean;
  httpUrl?: string;
  httpBody?: string;
  httpHeaders?: string;
};
