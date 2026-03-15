/**
 * E2E: ensure the mobile filter drawer introduces <0.1 CLS.
 */

describe('Mobile filter drawer CLS', () => {
  it('opens and closes with negligible layout shift', () => {
    cy.viewport('iphone-6');
    cy.visit('/');

    let cls = 0;
    cy.window().then((win) => {
      // @ts-ignore - PerformanceObserver is browser-only
      new win.PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) cls += entry.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
    });

    cy.contains('button', 'Filters').click();
    cy.wait(400);
    cy.get("button[aria-label='Close filters panel']").click();

    cy.window().then(() => {
      expect(cls).to.be.lessThan(0.1);
    });
  });
});
