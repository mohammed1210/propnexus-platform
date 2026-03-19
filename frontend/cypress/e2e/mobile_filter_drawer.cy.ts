describe('Mobile filter drawer', () => {
  it('opens, updates filters, and closes on apply', () => {
    cy.viewport('iphone-6');
    cy.visit('/search?q=london');

    cy.get("button[aria-controls='mobile-filter-drawer']")
      .filter(':visible')
      .first()
      .as('drawerToggle')
      .should('have.attr', 'aria-expanded', 'false')
      .click();

    cy.get('#mobile-filter-drawer').should('have.class', 'translate-y-0');
    cy.get('@drawerToggle').should('have.attr', 'aria-expanded', 'true');

    cy.get('#mobile-filter-drawer').within(() => {
      cy.contains('button', /^3$/).click();
    });
    cy.location('search').should('include', 'beds=3-3');

    cy.get('#mobile-filter-drawer').within(() => {
      cy.contains('button', /^Apply$/i).click();
    });

    cy.get('#mobile-filter-drawer').should('have.class', 'translate-y-full');
    cy.get('@drawerToggle').should('have.attr', 'aria-expanded', 'false');
  });
});
