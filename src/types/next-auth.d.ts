import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      uid:   string;
      email: string;
      name:  string;
      role:  string;
    };
  }

  interface User {
    uid:  string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid:  string;
    role: string;
  }
}