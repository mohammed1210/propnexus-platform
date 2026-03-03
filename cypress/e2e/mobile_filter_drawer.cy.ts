describe('Mobile filter drawer', () => {
  it('opens, updates filters, and closes on apply', () => {
    cy.viewport('iphone-6');
    cy.visit('/search?q=london');

    cy.contains('button', /filters/i).click();
    cy.contains('h2', /filters/i).should('be.visible');

    cy.contains('button', '3').click();
    cy.contains('button', /^Apply$/i).click();

    cy.contains('h2', /filters/i).should('not.exist');
    cy.location('search').should('include', 'beds=3-3');
  });
});
