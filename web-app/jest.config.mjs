export default {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.ts$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          esModuleInterop: true,
          isolatedModules: true,
          types: ["jest", "node"],
        },
      },
    ],
  },
};
