const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

router.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    let contacts = await prisma.contact.findMany({
      where: {
        OR: [{ email: email }, { phoneNumber: phoneNumber }],
      },
      orderBy: { createdAt: "asc" },
    });

    if (contacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });
      contacts = [newContact];
    } else {
      const primaryContact = contacts[0];

      const existingContact = contacts.find(
        (c) => c.email === email && c.phoneNumber === phoneNumber
      );

      if (!existingContact && contacts.length === 1) {
        await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          },
        });
      }
      await prisma.contact.updateMany({
        where: {
          OR: [
            { email: { in: contacts.map((c) => c.email).filter(Boolean) } },
            {
              phoneNumber: {
                in: contacts.map((c) => c.phoneNumber).filter(Boolean),
              },
            },
          ],
          id: { not: primaryContact.id },
        },
        data: {
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });
      contacts = await prisma.contact.findMany({
        where: {
          OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
        },
        orderBy: { createdAt: "asc" },
      });
    }

    const primaryContact = contacts[0];
    const emails = Array.from(
      new Set(contacts.map((c) => c.email).filter(Boolean))
    );
    const phoneNumbers = Array.from(
      new Set(contacts.map((c) => c.phoneNumber).filter(Boolean))
    );
    const secondaryContactIds = contacts
      .filter((c) => c.id !== primaryContact.id)
      .map((c) => c.id);

    res.json({
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error("Error identifying contact:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

module.exports = router;
