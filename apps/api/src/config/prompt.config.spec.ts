import { existsSync } from 'fs';
import { join } from 'path';
import { promptConfig } from './prompt.config';

describe('promptConfig', () => {
  const cwd = process.cwd();
  const saved = process.env.PROMPT_TEMPLATES_DIR;

  afterEach(() => {
    process.chdir(cwd);
    if (saved === undefined) delete process.env.PROMPT_TEMPLATES_DIR;
    else process.env.PROMPT_TEMPLATES_DIR = saved;
  });

  it('finds the shared prompts when the process starts in another directory', () => {
    delete process.env.PROMPT_TEMPLATES_DIR;
    process.chdir(join(__dirname, '..', '..', '..', '..'));

    const dir = promptConfig().templatesDir;

    expect(existsSync(join(dir, 'ewi', 'cv-claims.system.prompt.txt'))).toBe(
      true,
    );
  });

  it('uses PROMPT_TEMPLATES_DIR when it is set', () => {
    process.env.PROMPT_TEMPLATES_DIR = '/custom/prompts';
    expect(promptConfig().templatesDir).toBe('/custom/prompts');
  });
});
