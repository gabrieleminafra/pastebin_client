import io from "socket.io-client";
import client from "axios";
import toast, { Toaster } from "react-hot-toast";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArchiveIcon, PlusIcon } from "lucide-react";

export function meta() {
  return [{ title: "Pastebin" }];
}

const INITIAL_PASTE_DATA = {
  id: null,
  title: "",
  content: "",
};

export default function Home() {
  const socketRef = useRef(null);

  const [selectedPaste, setSelectedPaste] = useState(INITIAL_PASTE_DATA);
  const [pasteItems, setPasteItems] = useState([]);
  const [isFocused, setIsFocused] = useState(true);

  const handlePastePublish = async (body) => {
    try {
      const { data } = await client.post(
        import.meta.env.VITE_API_ENDPOINT + "/clipboard/publish",
        body
      );

      setSelectedPaste(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePasteDelete = async (id) => {
    try {
      await client.delete(
        `${import.meta.env.VITE_API_ENDPOINT}/clipboard/${id}/delete`
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleInitialLoad = async (body) => {
    try {
      const { data } = await client.get(
        import.meta.env.VITE_API_ENDPOINT + "/clipboard/all"
      );

      setPasteItems(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    handleInitialLoad();
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_API_ENDPOINT, {
        transports: ["websocket"],
      });

      socketRef.current.on("new_paste", (payload) => {
        setPasteItems((state) => [...state, payload]);
      });

      socketRef.current.on("delete_paste", (payload) => {
        setPasteItems((state) => state.filter((item) => item.id !== payload));
      });

      socketRef.current.on("update_paste", (payload) => {
        setPasteItems((state) =>
          state.map((item) => {
            if (item.id === payload.id) return payload;
            return item;
          })
        );
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const workingItem = pasteItems.find((item) => item.id == selectedPaste.id);

    if (workingItem && isFocused) {
      toast.success("Sono state ignorate delle modifiche in ingresso");
      return;
    }

    if (!workingItem) {
      setSelectedPaste(INITIAL_PASTE_DATA);
      return;
    }

    if (pasteItems) setSelectedPaste(workingItem ?? selectedPaste);
  }, [pasteItems]);

  const emitUpdateEvent = () => {
    if (!selectedPaste.id) return;
    socketRef.current.emit("edit_paste", {
      title: selectedPaste.title,
      content: selectedPaste.content,
      id: selectedPaste.id,
      client_id: socketRef.current.id,
    });
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    emitUpdateEvent();
  };

  return (
    <Fragment>
      <Toaster />
      <div className="flex flex-col md:flex-row h-screen bg-gray-100 p-4 py-12 gap-4">
        <div className="w-full md:w-2/8 bg-white p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-800">Tutti i paste</h2>
          <ul className="space-y-3 overflow-y-auto">
            {pasteItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedPaste(item)}
                className={`p-3 hover:bg-gray-400 rounded-lg text-gray-700 font-semibold cursor-pointer transition ${
                  selectedPaste.id === item.id ? "bg-sky-300" : "bg-gray-200"
                }`}
              >
                {item.title}
              </li>
            ))}
            <li
              onClick={() => setSelectedPaste(INITIAL_PASTE_DATA)}
              className="p-3 bg-sky-600 hover:bg-sky-800 rounded-lg text-white font-semibold cursor-pointer transition flex justify-between"
            >
              Crea nuovo paste <PlusIcon />
            </li>
          </ul>
        </div>

        <div className="w-full w-4/8 md:w-5/8 flex flex-col items-center justify-center md:mx-4">
          <div className="w-full bg-white p-6 rounded-xl shadow-xl flex flex-col gap-4 flex-1">
            <h2 className="text-xl font-semibold text-gray-800">
              {selectedPaste.created_at
                ? `Paste del ${new Date(
                    selectedPaste.created_at
                  ).toLocaleString("it-IT")}`
                : "Nuovo paste"}
            </h2>
            <input
              type="text"
              value={selectedPaste.title}
              onChange={(e) =>
                setSelectedPaste((state) => ({
                  ...state,
                  title: e.target.value,
                }))
              }
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Inserisci testo..."
            />
            <textarea
              value={selectedPaste.content}
              onChange={(e) =>
                setSelectedPaste((state) => ({
                  ...state,
                  content: e.target.value,
                }))
              }
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full p-3 border border-gray-300 rounded-lg h-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Scrivi qui..."
              rows={20}
            ></textarea>

            {!selectedPaste.id ? (
              <button
                className="p-3 bg-sky-600 hover:bg-sky-800 rounded-lg font-semibold text-white cursor-pointer transition flex justify-center"
                onClick={() =>
                  handlePastePublish({
                    title: selectedPaste.title,
                    content: selectedPaste.content,
                    client_id: socketRef.current.id,
                  })
                }
              >
                Salva paste
                <PlusIcon className="ml-3" />
              </button>
            ) : (
              <button
                className="p-3 bg-red-400 text-white rounded-lg font-semibold cursor-pointer transition flex justify-center"
                onClick={() => handlePasteDelete(selectedPaste.id)}
              >
                Archivia questo paste
                <ArchiveIcon className="ml-3" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full lg:w-2/8 bg-white p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-800">Allegati</h2>
          <ul className="space-y-3 overflow-y-auto">
            {/* {pasteItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedPaste(item)}
                className={`p-3 hover:bg-gray-400 rounded-lg text-gray-700 font-semibold cursor-pointer transition ${
                  selectedPaste.id === item.id ? "bg-sky-300" : "bg-gray-200"
                }`}
              >
                {item.title}
              </li>
            ))} */}
            <li
              // onClick={() => setSelectedPaste(INITIAL_PASTE_DATA)}
              className="p-3 aspect-square bg-sky-600 hover:bg-sky-800 rounded-lg text-white font-semibold cursor-pointer transition grid place-content-center"
            >
              <PlusIcon size={40} />
            </li>
          </ul>
        </div>
      </div>
    </Fragment>
  );
}
