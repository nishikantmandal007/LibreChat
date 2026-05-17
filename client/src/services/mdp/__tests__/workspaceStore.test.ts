import { getWorkspaceSkill, importWorkspaceSkill, listWorkspaceSkills } from '../workspaceStore';

describe('workspace skill import', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('imports SKILL.md-style markdown with a stable skill id', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(
        [
          [
            '---',
            'name: brand-guidelines',
            'description: Apply the brand voice to generated documents',
            'always-apply: false',
            '---',
            '# Brand Guidelines',
            '',
            'Use concise, direct language.',
          ].join('\n'),
        ],
        'brand-guidelines.md',
        { type: 'text/markdown' },
      ),
    );

    const skill = await importWorkspaceSkill(formData);

    expect(skill._id).toMatch(/^skill_/);
    expect(skill.name).toBe('brand-guidelines');
    expect(skill.description).toBe('Apply the brand voice to generated documents');
    expect(skill.body).toContain('Use concise, direct language.');
    expect(getWorkspaceSkill(skill._id)?._id).toBe(skill._id);
    expect(listWorkspaceSkills().skills[0]._id).toBe(skill._id);
  });
});
