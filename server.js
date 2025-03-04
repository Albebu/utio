import express from 'express';
import fetch from 'node-fetch'
const app = express();

const CLIENTIFY_API_KEY = "e8ffbf558376e04a2acd4dfd282e60a142c9fb26";
const UTIO_API_KEY = 'c928875d44c99b55d88ab78c71f2015d7fecef4e9e7cd86e3ef33731f76e5cb083fa62b47af7e9c3';
const UTIO_CHATS_URL = '67c55fb63fcb09fffabc1c72';

app.use(express.json());

const OWNERS = [
    "susana.nocete@npro.es",
    "edgar.berrocal@npro.es",
    "andrea.lopez@npro.es",
];

app.post("/utio-chat", async (req, res) => {
    try {
        const data = req.body;

        const hasOwner = data.data.chat.owner.agent; // Si tiene un propietario
        // Permitir solo los que no tienen propietario en Utio
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

        // Solo tratar contactos que su número de télefono aparezca 1 única vez en Clientify
        if (contactData.count === 0) return res.status(404).send("No existe el contacto en la base de datos.");
        if (contactData.count > 1) return res.status(400).send("Existen varios contactos con ese número de teléfono.");

        // Obtener el email y el nombre del propietario del contacto
        const contactOwner = contactData.results[0].owner;
        const contactOwnerName = contactData.results[0].owner_name;
        let exists = false;

        // Buscar si el propietario es de VI
        for (let owner of OWNERS) {
            if (contactOwner.includes(owner)) {
                exists = true;
                break;
            }
        }

        // Si el contacto no existe o no es de VI lo asignamos a Atención al cliente
        if (!exists) {
            // Cabmio de propietario
            const updateResponse = await fetch(`https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/chats/+34${phoneNumber}/owner`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token: ${UTIO_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "email": 'info@npro.es'
                })
            });

            const updateData = await updateResponse.json();
            console.log("Respuesta de actualización:", updateData);
        }

        // Si el contacto existe en Clientify lo asignamos a VI y le cambiamos el nombre y ponemos su nombre junto al nombre de propietario.
        if (exists) {
            // Cambio de propietario
            const updateResponse = await fetch(`https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/chats/+34${phoneNumber}/owner`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token: ${UTIO_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "email": 'vi@npro.es'
                })
            });

            const updateOwnerData = await updateResponse.json();
            console.log("Respuesta de actualización:", updateOwnerData);

            // Cambio de nombre
            const updateNameResponse = await fetch(`https://whatsapp-api.utio.io/v1/chat/${UTIO_CHATS_URL}/contacts/+34${phoneNumber}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token: ${UTIO_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `${name} (${contactOwnerName})`
                })
            });

            const updateNameData = await updateNameResponse.json();
            console.log("Respuesta de actualización:", updateNameData);
        }

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
