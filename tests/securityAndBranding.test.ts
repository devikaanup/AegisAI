import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe("Security, Privacy & Brand Integrity Verification", () => {
  const rootDir = path.resolve(__dirname, "..");
  const componentsFiles = getAllFiles(path.join(rootDir, "components"));
  const appFiles = getAllFiles(path.join(rootDir, "app"));
  const libFiles = getAllFiles(path.join(rootDir, "lib"));

  it("lib/gemini.ts strictly includes 'server-only'", () => {
    const geminiContent = fs.readFileSync(path.join(rootDir, "lib/gemini.ts"), "utf-8");
    expect(geminiContent).toContain('import "server-only"');
  });

  it("GEMINI_API_KEY is never referenced in client code (/components or /app client components)", () => {
    const clientFiles = [...componentsFiles, ...appFiles.filter((f) => !f.includes("/api/"))];

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("GEMINI_API_KEY");
      expect(content).not.toContain("NEXT_PUBLIC_GEMINI");
    }
  });

  it("no visible branding instance of 'SafeRoute' or 'SAFEROUTE' in app, components, or README.md", () => {
    const checkFiles = [
      ...componentsFiles,
      ...appFiles,
      path.join(rootDir, "README.md"),
    ].filter((f) => fs.existsSync(f));

    for (const file of checkFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Allow lowercase filenames or package names if any, but no visible user-facing brand
      expect(content).not.toContain("SafeRoute");
      expect(content).not.toContain("SAFEROUTE");
    }
  });

  it("no React Native, Expo, or Flutter dependencies exist in package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    expect(allDeps["react-native"]).toBeUndefined();
    expect(allDeps["expo"]).toBeUndefined();
    expect(allDeps["flutter"]).toBeUndefined();
  });

  it("no calls to navigator.geolocation exist in the codebase", () => {
    const allSourceFiles = [...componentsFiles, ...appFiles, ...libFiles];

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("navigator.geolocation");
      expect(content).not.toContain("getCurrentPosition");
    }
  });

  it("no hardcoded illustrative numbers ('240m', '2.9 min', '+5.2 min', '700m', '9.7 min') in /components", () => {
    const bannedPlaceholders = ["240m", "2.9 min", "+5.2 min", "700m", "9.7 min"];

    for (const file of componentsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const banned of bannedPlaceholders) {
        expect(content).not.toContain(`"${banned}"`);
        expect(content).not.toContain(`'${banned}'`);
      }
    }
  });
});
