import { CLIENTIFY_API_KEY, UTIO_API_KEY, UTIO_CHATS_URL } from "./env.js";

/**
 * Asigna un chat a un usuario de Utio enviando un PATCH.
 * @param {string} phoneNumber - Número de teléfono sin el código de país.
 * @param {string} email - Email del usuario de Utio al que asignar el chat.
 */
export async function assignChat(phoneNumber, email) {
  const url = `https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/chats/+34${phoneNumber}/owner`;
  const body = JSON.stringify({ email });

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        // Se elimina el ":" para dejar el formato consistente con el resto de las llamadas.
        Authorization: `Token ${UTIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      console.error(`Error asignando chat: ${response.statusText}`);
      return null;
    }
    const updateOwnerData = await response.json();
    return updateOwnerData;
  } catch (error) {
    console.error("Error en assignChat:", error);
    throw error;
  }
}

/**
 * Actualiza el nombre de un contacto añadiendo el nombre de su propietario.
 * @param {string} phoneNumber - Número de teléfono sin el +34.
 * @param {string} currentName - Nombre actual del contacto.
 * @param {string} owner - Nombre del propietario.
 */
export async function updateContactName(phoneNumber, currentName, owner) {
  const url = `https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/contacts/+34${phoneNumber}`;
  const updatedName = `${currentName} (${owner})`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Token ${UTIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: updatedName }),
    });

    if (!response.ok) {
      console.error(
        `Error actualizando nombre de contacto: ${response.statusText}`
      );
      return null;
    }
    const updateNameData = await response.json();
    return updateNameData;
  } catch (error) {
    console.error("Error en updateContactName:", error);
    throw error;
  }
}

/**
 * Crea una nota en Clientify.
 * @param {string} contactId - ID del contacto.
 * @param {string} noteName - Nombre de la nota.
 * @param {string} noteContent - Contenido del comentario.
 */
export async function createClientifyNote(contactId, noteName, noteContent) {
  const url = `https://api.clientify.net/v1/contacts/${contactId}/note/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${CLIENTIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: noteName, comment: noteContent }),
    });

    if (!response.ok) {
      console.error("Error creando la nota: ", response.statusText);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error("Error en createClientifyNote:", e);
    throw e;
  }
}

/**
 * Consulta la información de un contacto en Clientify a partir de su número de teléfono.
 * @param {string} phoneNumber - Número de teléfono sin el +34.
 */
export async function getUserByPhoneClientify(phoneNumber) {
  try {
    const clientifyUrl = `https://api.clientify.net/v1/contacts/?phone=${phoneNumber}`;
    const response = await fetch(clientifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Token ${CLIENTIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Error obteniendo datos del contacto: ${response.statusText}`
      );
      return null;
    }
    return await response.json();
  } catch (e) {
    createError("getUserByPhoneClientify");
  }
}

export async function sendUtioMessage(fromNumber) {
  const message = `
                ☝️☝️☝️
                Para recibir una mejor atención, por favor, pulse sobre el contacto de atención a profesionales
                `;

  await fetch("https://whatsapp-api.utio.io/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Token: UTIO_API_KEY,
    },
    body: JSON.stringify({ phone: fromNumber, message }),
  });
}

export async function sendNotificationToInbox(
  contactFirstName,
  contactSecondName,
  ownerName,
  fromNumber
) {
  // Enviar notificación al equipo
  const message = `Nuevo mensaje de ${contactFirstName} ${contactSecondName} de ${ownerName} (${fromNumber}). Revisa Utio: https://whatsapp.utio.io/${UTIO_CHATS_URL}/c/${fromNumber}`;

  await fetch("https://whatsapp-api.utio.io/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Token ${UTIO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: "+34621415478",
      message,
      contacts: [{ phone: "+34621415478", name: "Npro profesional" }],
    }),
  });
}

export async function sendContactUtioMessage(fromNumber) {
  await fetch("https://whatsapp-api.utio.io/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Token: UTIO_API_KEY,
    },
    body: JSON.stringify({
      phone: JSON.stringify({ phone: fromNumber }),
      contacts: [{ phone: "+34621415478", name: "Npro profesional" }],
    }),
  });
}

export async function getActualDate() {
  const date = new Date();
  const day = date.getDate();
  const hour = date.getHours();
  const month = date.getMonth();
  const minute = date.getMinutes();

  return { day, hour, month, minute };
}

export async function createError(message) {
  const { minute, hour, day, month } = getActualDate();
  console.error(`${month}/${day} ${hour}:${minute}. ERROR: ${message}`);
}
