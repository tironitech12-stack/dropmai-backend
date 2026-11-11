export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export const DEMO_USER: SessionUser = {
  id: 'demo-seller-1',
  email: 'paulo@dropmai.com.br',
  name: 'Paulo Regis Tironi',
};

export const SESSION_COOKIE = 'dropmai_session';
