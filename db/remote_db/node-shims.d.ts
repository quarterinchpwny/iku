declare const process: {
  argv: string[];
  exit(code?: number): never;
};

declare module 'child_process' {
  export function execSync(command: string): { toString(): string };
}

declare module 'minimist' {
  export default function minimist(args: string[]): Record<string, any>;
}
