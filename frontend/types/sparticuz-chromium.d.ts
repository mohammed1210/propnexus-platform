declare module '@sparticuz/chromium' {
  const chromium: {
    args: string[];
    executablePath(): Promise<string>;
  };

  export default chromium;
}
