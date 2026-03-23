describe('Mobile filter drawer', () => {
  it('opens, updates filters, and closes on apply', () => {
    cy.viewport('iphone-6');
    cy.visit('/search?q=london');

    const drawerToggleSelector = "button[aria-controls='mobile-filter-drawer']";

    cy.get(drawerToggleSelector).filter(':visible').first().should('have.attr', 'aria-expanded', 'false');
    cy.get(drawerToggleSelector).filter(':visible').first().click({ force: true });
    cy.get(drawerToggleSelector)
      .filter(':visible')
      .first()
      .then(($btn) => {
        if ($btn.attr('aria-expanded') !== 'true') {
          cy.wrap($btn).click({ force: true });
        }
      });

    cy.get(drawerToggleSelector).filter(':visible').first().should('have.attr', 'aria-expanded', 'true');
    cy.get('#mobile-filter-drawer').should('not.have.class', 'translate-y-full');

    cy.get('#mobile-filter-drawer').within(() => {
      cy.contains('button', /^3$/).should('be.visible').click();
    });
    cy.location('search').should('include', 'beds=3-3');

    cy.get('#mobile-filter-drawer').within(() => {
      cy.contains('button', /^Apply$/i).should('be.visible').click();
    });

    cy.get('#mobile-filter-drawer').should('have.class', 'translate-y-full');
    cy.get(drawerToggleSelector).filter(':visible').first().should('have.attr', 'aria-expanded', 'false');
  });
});
