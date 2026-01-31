// Type declarations for optional dependencies that may not be installed

declare module 'plivo' {
  export class Client {
    constructor(authId: string, authToken: string);
    messages: {
      create: (params: {
        src: string;
        dst: string;
        text: string;
        [key: string]: any;
      }) => Promise<any>;
    };
  }
}
