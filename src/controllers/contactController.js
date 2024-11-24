const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const identifyContact = async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    let contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email: email || undefined },
          { phoneNumber: phoneNumber || undefined },
        ],
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
      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    let primaryContact =
      contacts.find((c) => c.linkPrecedence === "primary") || contacts[0];

    await prisma.contact.updateMany({
      where: {
        id: {
          in: contacts
            .map((c) => c.id)
            .filter((id) => id !== primaryContact.id),
        },
      },
      data: {
        linkedId: primaryContact.id,
        linkPrecedence: "secondary",
      },
    });

    const emailContact = contacts.find((c) => c.email === email);
    const phoneContact = contacts.find((c) => c.phoneNumber === phoneNumber);

    if (!emailContact || !phoneContact) {
      const existingContactWithBoth = contacts.find(
        (c) => c.email === email && c.phoneNumber === phoneNumber
      );

      if (!existingContactWithBoth) {
        await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          },
        });
      }
    }

    const allRelatedContacts = await prisma.contact.findMany({
      where: {
        OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
      },
      orderBy: { createdAt: "asc" },
    });

    const emails = Array.from(
      new Set(allRelatedContacts.map((c) => c.email).filter(Boolean))
    );
    const phoneNumbers = Array.from(
      new Set(allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean))
    );
    const secondaryContactIds = allRelatedContacts
      .filter((c) => c.id !== primaryContact.id)
      .map((c) => c.id);

    res.status(200).json({
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error("Error identifying contact:", error);
    res.status(500).json({
      message: "An error occurred while processing the request",
      error: error.message,
    });
  }
};

module.exports = { identifyContact };
