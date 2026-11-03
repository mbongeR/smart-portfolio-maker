export function detectStack(files: Record<string, string>): string[] {
  const stack = new Set<string>();
  const packageJson = files["package.json"];
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      for (const name of Object.keys(deps)) stack.add(name);
    } catch { /* malformed manifests are ignored; README evidence still works */ }
  }
  const pyproject = files["pyproject.toml"];
  if (pyproject) {
    if (/\bfastapi\b/i.test(pyproject)) stack.add("FastAPI");
    if (/\bdjango\b/i.test(pyproject)) stack.add("Django");
    if (/\bpytest\b/i.test(pyproject)) stack.add("pytest");
    stack.add("Python");
  }
  if (files["go.mod"]) stack.add("Go");
  return [...stack].sort();
}
