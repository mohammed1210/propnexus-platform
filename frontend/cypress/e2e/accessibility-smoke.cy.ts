describe("search accessibility smoke", () => {
  it("announces result count via aria-live region", () => {
    cy.visit("/search?q=london");

    cy.get("[role='status'][aria-live='polite']")
      .should("exist")
      .and("contain.text", "Showing");
  });
});
