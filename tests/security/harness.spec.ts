import { test, expect } from '@playwright/test';

test.describe('security harness integrity', () => {
  test('bypassCSP is restricted strictly to the layout project', () => {
    const projects = test.info().config.projects;
    const layoutProject = projects.find((p) => p.name === 'layout');

    expect(layoutProject, 'layout project must be defined in config').toBeDefined();
    expect(layoutProject?.use.bypassCSP, 'layout project must set bypassCSP to true').toBe(true);

    const testMatch = layoutProject?.testMatch;
    const matchStrings = Array.isArray(testMatch) ? testMatch.map(String) : [String(testMatch)];
    for (const pattern of matchStrings) {
      expect(pattern).toMatch(/^layout\//);
      expect(pattern).not.toContain('e2e');
      expect(pattern).not.toContain('security');
    }

    for (const project of projects) {
      if (project.name === 'layout') continue;
      expect(
        project.use.bypassCSP,
        `project "${project.name}" must have bypassCSP falsy`,
      ).toBeFalsy();
    }
  });
});
