describe('click logging', () => {
  it('posts a search click when a listing card is opened', () => {
    cy.intercept('POST', '**/api/events/search_click').as('searchClick');
    cy.visit('/listings?q=london');
    cy.get('[data-testid="property-card"]').should('have.length.greaterThan', 2);
    cy.get('[data-testid="property-card"]').eq(2).click();
    cy.wait('@searchClick').its('response.statusCode').should('eq', 200);
  });
});
