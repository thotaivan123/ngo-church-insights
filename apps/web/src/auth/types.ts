export type DemoSession = {
  mode: "demo";
  userId: string;
  email: string;
};

export type CognitoSession = {
  mode: "cognito";
  userId: string;
  email: string;
  idToken: string;
};

export type AuthSession = DemoSession | CognitoSession;
