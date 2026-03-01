describe('search filter flow', () => {
  it('applies beds + price filters and refreshes results', () => {
    cy.visit('/search');

    cy.contains('button', '3').click();
    cy.get('input[type="range"]').eq(1).invoke('val', 300000).trigger('input').trigger('change');

    cy.location('search').should('include', 'beds=3-3');
    cy.location('search').should('include', 'price_max=300000');

    cy.contains('results');
  });
});
