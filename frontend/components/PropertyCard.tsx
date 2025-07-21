.card {
  display: flex;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  color: inherit;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.imageWrapper {
  flex: 0 0 160px;
  height: 160px;
  overflow: hidden;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #0f172a;
}

.location {
  font-size: 14px;
  color: #64748b;
}

.price {
  font-size: 18px;
  font-weight: 700;
  margin-top: 8px;
  color: #1e293b;
}

.details {
  font-size: 14px;
  margin-top: 4px;
  color: #475569;
}

.metrics {
  font-size: 14px;
  color: #0284c7;
  margin-top: 6px;
}

.buttons {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

.save,
.detailsBtn {
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.save {
  background: #14b8a6;
  color: white;
}

.detailsBtn {
  background: #e2e8f0;
  color: #1e293b;
}

.save:hover {
  background: #0d9488;
}

.detailsBtn:hover {
  background: #cbd5e1;
}
