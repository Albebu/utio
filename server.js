import express from 'express';
import fetch from 'node-fetch'
const app = express();

const CLIENTIFY_API_KEY = "e8ffbf558376e04a2acd4dfd282e60a142c9fb26";
const UTIO_API_KEY = 'c928875d44c99b55d88ab78c71f2015d7fecef4e9e7cd86e3ef33731f76e5cb083fa62b47af7e9c3';
const UTIO_CHATS_URL = '67c55fb63fcb09fffabc1c72';

app.use(express.json());

/** 
 *
 * @param {string} email - Email del usuario de Utio al que asignar el chat
 * @returns {void}
 * 
*/
async function asignChat(email) {
    const updateResponse = await fetch(`https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/chats/+34${phoneNumber}/owner`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Token: ${UTIO_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "email": email
        })
    });

    const updateOwnerData = await updateResponse.json();
    console.log("Respuesta de actualización:", updateOwnerData);
}

/**
 * 
 * @param {string} name - Nombre antiguo del contacto para no sobreescribirlo por completo
 * @param {string} owner - Nombre del propietario del contacto
 */
async function changeName(name, owner) {
    const updateNameResponse = await fetch(`https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/contacts/+34${phoneNumber}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Token: ${UTIO_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: `${name} (${owner})`
        })
    });

    const updateNameData = await updateNameResponse.json();
    console.log("Respuesta de actualización:", updateNameData);
}

app.post("/utio-chat", async (req, res) => {
    try {
        const data = req.body;

        // Permitir solo usuarios sin propietario
        const hasOwner = data.data.chat.owner.agent;
        if (hasOwner !== null) {
            console.log("EL contacto ya tiene un propietario");
            return res.status(200).send("El contacto ya tiene un propietario.");
        }

        // Quitamos el +34 para buscar en Clientify el usuario por el número
        const phoneNumber = data.data.fromNumber.replace("+34", "");
        const name = data.data.chat.contact.info.name;

        // Obtener los datos del contacto buscandolo por el número de télefono
        const contactResponse = await fetch(
            `https://api.clientify.net/v1/contacts/?phone=${phoneNumber}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Token ${CLIENTIFY_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );
        const contactData = await contactResponse.json();

        /*
            Si no existe el contacto en Clientify lo asignamos a Atención al cliente.
        */
        if (contactData.count === 0) asignChat('info@npro.es');

        /*
            Si hay más de un contacto con ese número lo asignamos a VI pero no le ponemos el nombre del propietario, en su lugar ponemos un Num. Repetido
        */

        if (contactData.count > 1) {
            asignChat('vi@npro.es');
            changeName(name, 'Num. Repetido');
            return res.status(200).send("Contacto registrado sin propietario correctamente");
        }
        /*
            Si solo hay un contacto con ese número lo asignamos a VI y ponemos el nombre del propietario
        */
        const contactOwnerName = contactData.results[0].owner_name;
        asignChat('vi@npro.es');
        changeName(name, contactOwnerName)

        return res.status(200).send("Webhook recibido correctamente");
    } catch (e) {
        console.error("Error: ", e);
        if (!res.headersSent) {
            return res.status(500).send("Hubo un error al procesar el webhook.");
        }
    }
});


app.listen(3000, () =>
    console.log("Servidor escuchando en http://localhost:3000")
);
