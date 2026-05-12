-- Daraja qiymatlarini standartlash: Boshlovchi → Boshlang'ich, Ilg'or → Yuqori
-- Frontend (Courses sahifa filter) bilan moslash uchun.

UPDATE courses SET daraja = 'Boshlang''ich' WHERE daraja = 'Boshlovchi';
UPDATE courses SET daraja = 'Yuqori' WHERE daraja = 'Ilg''or';
