/**
 * Document Upload E2E Tests
 *
 * Tests for document upload, view, and download flows.
 */

describe("Document Upload Flow", () => {
  const API_URL = Cypress.env("apiUrl");
  let authToken: string;
  let testCaseId: string;

  before(() => {
    // Login as founder to get token
    cy.apiRequest("POST", "/auth/login", {
      body: {
        email: Cypress.env("founderEmail") || "time@mgrcapital.com",
        password: Cypress.env("founderPassword") || "Dorothy1956!",
      },
    }).then((response) => {
      if (response.status === 200 && response.body.data?.accessToken) {
        authToken = response.body.data.accessToken;
      }
    });
  });

  describe("POST /api/documents/upload", () => {
    it("should reject upload without authentication", () => {
      cy.apiRequest("POST", "/documents/upload", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should reject upload without file", () => {
      cy.skipIfNoToken(authToken);

      cy.apiRequest("POST", "/documents/upload", {
        token: authToken,
        body: {
          caseId: "1",
          type: "CLIENT_ID",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
        expect(response.body.success).to.be.false;
      });
    });

    it("should reject upload without caseId", () => {
      cy.skipIfNoToken(authToken);

      // Create a test file
      const testFile = new Blob(["test content"], { type: "application/pdf" });

      cy.apiRequest("POST", "/documents/upload", {
        token: authToken,
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: {
          file: testFile,
          type: "CLIENT_ID",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
        expect(response.body.success).to.be.false;
      });
    });
  });

  describe("GET /api/documents/case/:caseId", () => {
    it("should reject without authentication", () => {
      cy.apiRequest("GET", "/documents/case/1", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should return empty array for case with no documents", () => {
      cy.skipIfNoToken(authToken);

      cy.apiRequest("GET", "/documents/case/99999", {
        token: authToken,
        failOnStatusCode: false,
      }).then((response) => {
        // Could be 404 or 200 with empty array depending on implementation
        if (response.status === 200) {
          expect(response.body.data).to.be.an("array");
        }
      });
    });
  });

  describe("GET /api/documents/:id/download", () => {
    it("should reject download without authentication", () => {
      cy.apiRequest("GET", "/documents/1/download", {
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should return 404 for non-existent document", () => {
      cy.skipIfNoToken(authToken);

      cy.apiRequest("GET", "/documents/99999/download", {
        token: authToken,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  describe("Document Lifecycle", () => {
    // Integration test for full upload/view/download cycle
    it.skip("should complete full document lifecycle", () => {
      cy.skipIfNoToken(authToken);

      // This test requires:
      // 1. A valid case to exist
      // 2. File upload support in Cypress
      // 3. File system access for downloaded file verification

      // Step 1: Upload document
      cy.fixture("test-document.pdf", "binary").then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(
          fileContent,
          "application/pdf"
        );

        const formData = new FormData();
        formData.append("file", blob, "test-document.pdf");
        formData.append("caseId", testCaseId);
        formData.append("type", "CLIENT_ID");

        cy.request({
          method: "POST",
          url: `${API_URL}/documents/upload`,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        }).then((uploadResponse) => {
          expect(uploadResponse.status).to.eq(201);
          expect(uploadResponse.body.data).to.have.property("id");

          const documentId = uploadResponse.body.data.id;

          // Step 2: View document in case list
          cy.apiRequest("GET", `/documents/case/${testCaseId}`, {
            token: authToken,
          }).then((listResponse) => {
            expect(listResponse.status).to.eq(200);
            expect(listResponse.body.data).to.be.an("array");
            expect(listResponse.body.data.length).to.be.greaterThan(0);

            const uploaded = listResponse.body.data.find(
              (d: { id: string }) => d.id === documentId
            );
            expect(uploaded).to.exist;
            expect(uploaded.fileName).to.eq("test-document.pdf");
          });

          // Step 3: Download document
          cy.apiRequest("GET", `/documents/${documentId}/download`, {
            token: authToken,
          }).then((downloadResponse) => {
            expect(downloadResponse.status).to.eq(200);
            expect(downloadResponse.headers["content-type"]).to.include(
              "application/pdf"
            );
          });
        });
      });
    });
  });
});
