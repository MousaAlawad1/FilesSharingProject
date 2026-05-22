import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';

const CONTENT_DIR = path.resolve(process.cwd(), 'seo/content');

function walkDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkDirectory(absolutePath);
    }
    return absolutePath;
  });
}

function normalizeSlug(filePath) {
  const relativePath = path.relative(CONTENT_DIR, filePath).replace(/\\/g, '/');
  return relativePath.replace(/\/index\.md$/, '').replace(/\.md$/, '');
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/^#+\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
    .replace(/[>*_#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromSlug(slug) {
  return slug
    .split('/')
    .pop()
    .split('-')
    .filter(Boolean)
    .join(' ');
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) {
    return { frontmatter: {}, content: markdown };
  }

  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const rawFrontmatter = match[1];
  const content = markdown.slice(match[0].length);

  try {
    const parsed = parseYaml(rawFrontmatter) || {};
    return { frontmatter: parsed, content };
  } catch {
    return { frontmatter: {}, content: markdown };
  }
}

function comparePosts(a, b) {
  const aDate = a.frontmatter.date ? Date.parse(a.frontmatter.date) : 0;
  const bDate = b.frontmatter.date ? Date.parse(b.frontmatter.date) : 0;
  return bDate - aDate || a.slug.localeCompare(b.slug);
}

export function getBlogPosts() {
  const markdownFiles = walkDirectory(CONTENT_DIR).filter((filePath) => filePath.endsWith('.md'));

  return markdownFiles
    .map((filePath) => {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content } = parseFrontmatter(raw);
      const slug = normalizeSlug(filePath);
      const title = frontmatter.title || titleFromSlug(slug);
      const description = frontmatter.description || stripMarkdown(content).slice(0, 160);
      const date = frontmatter.date || fs.statSync(filePath).mtime.toISOString().slice(0, 10);

      return {
        slug,
        title,
        description,
        markdown: content,
        frontmatter: {
          ...frontmatter,
          date,
          tags: Array.isArray(frontmatter.tags)
            ? frontmatter.tags.map(String)
            : typeof frontmatter.tags === 'string'
            ? frontmatter.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
            : [],
        },
      };
    })
    .sort(comparePosts);
}

export function getBlogPostBySlug(slug) {
  return getBlogPosts().find((post) => post.slug === slug) || null;
}

export function getBlogRoutes() {
  const routes = getBlogPosts().map((post) => `/blog/${post.slug}/`);
  return ['/blog/', ...routes];
}

export function getSitemapLastmod() {
  const timestamps = getBlogPosts()
    .map((post) => Date.parse(post.frontmatter.date || ''))
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}
