export function githubFileUrl(repo: string, filePath: string): string {
  const [owner, name] = repo.split("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/edit/main/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function githubDeleteUrl(repo: string, filePath: string): string {
  const [owner, name] = repo.split("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/delete/main/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
