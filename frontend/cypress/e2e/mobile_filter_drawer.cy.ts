describe('Mobile filter drawer', () => {
  it('opens, updates filters, and closes on apply', () => {
    cy.viewport('iphone-6');
    cy.visit('/search?q=london');

    cy.get("button[aria-controls='mobile-filter-drawer']").first().click({ force: true });
    cy.contains('button', '3').click({ force: true });
    cy.contains('button', /^Apply$/i).click({ force: true });
    cy.location('search').should('include', 'beds=3-3');
  });
});
