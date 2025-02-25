import io from "socket.io-client";
import client from "axios";
import toast, { Toaster } from "react-hot-toast";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CloudUpload,
  Delete,
  Download,
  PlusIcon,
  Save,
} from "lucide-react";

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
  const [archiveItems, setArchiveItems] = useState([]);
  const [pendingChanges, setPendingChanges] = useState(0);

  const [isFocused, setIsFocused] = useState(true);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);
    try {
      Promise.all([
        await client
          .get(import.meta.env.VITE_API_ENDPOINT + "/clipboard/all")
          .then(({ data }) => setPasteItems(data)),
        await client
          .get(import.meta.env.VITE_API_ENDPOINT + "/archive/all")
          .then(({ data }) => setArchiveItems(data)),
        ,
      ]);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  const handleArchiveUplaod = async (data) => {
    setIsUploading(true);
    const payload = new FormData();
    payload.append("file", data);
    try {
      await client.post(
        `${import.meta.env.VITE_API_ENDPOINT}/archive/publish`,
        payload
      );
    } catch (error) {
      console.error(error);
    }
    setIsUploading(false);
    setFile(null);
  };

  const handleArchiveDownload = async (path) => {
    try {
      const { data } = await client.get(
        `${import.meta.env.VITE_API_ENDPOINT}/archive/get`,
        { params: { path: encodeURIComponent(path) }, responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const handleArchiveDelete = async (id) => {
    try {
      await client.delete(
        `${import.meta.env.VITE_API_ENDPOINT}/archive/${id}/delete`
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // handleInitialLoad();

    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_API_ENDPOINT, {
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        handleInitialLoad();
      });

      socketRef.current.on("disconnect", () => {
        toast.error("Connessione al live server persa");
      });

      socketRef.current.on("new_paste", (payload) => {
        setPasteItems((state) => [...state, payload]);
      });

      socketRef.current.on("new_archive", (payload) => {
        setArchiveItems((state) => [...state, payload]);
      });

      socketRef.current.on("delete_archive", (payload) => {
        setArchiveItems((state) => state.filter((item) => item.id !== payload));
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
    if (file) handleArchiveUplaod(file);
  }, [file]);

  useEffect(() => {
    if (pendingChanges < 10) {
      setPendingChanges(pendingChanges + 1);
      return;
    }

    emitUpdateEvent();
    setPendingChanges(0);
  }, [selectedPaste]);

  useEffect(() => {
    if (!pasteItems || !selectedPaste.id) return;
    const workingItem = pasteItems.find((item) => item.id == selectedPaste.id);

    if (workingItem && isFocused) {
      return;
    }

    if (!workingItem) {
      setSelectedPaste(INITIAL_PASTE_DATA);
      return;
    }

    setSelectedPaste(workingItem ?? selectedPaste);
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

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setPendingChanges(0);
    emitUpdateEvent();
  };

  return (
    <Fragment>
      <Toaster />
      <div
        className={`flex flex-col xl:flex-row h-screen bg-gray-100 p-4 py-12 gap-4 transition-opacity ${
          isLoading
            ? "opacity-40 pointer-events-none"
            : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="w-full xl:w-2/12 bg-white p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Tutti gli appunti
          </h2>
          <ul className="space-y-3 overflow-y-auto">
            {pasteItems.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedPaste(item)}
                className={`p-3 hover:bg-gray-400 rounded-lg text-gray-700 font-semibold cursor-pointer transition ${
                  selectedPaste.id === item.id ? "bg-sky-300" : "bg-gray-200"
                }`}
              >
                {item.title.slice(0, 30)}
              </li>
            ))}
            <li
              onClick={() => setSelectedPaste(INITIAL_PASTE_DATA)}
              className="p-3 bg-sky-600 hover:bg-sky-800 rounded-lg text-white font-semibold cursor-pointer transition flex justify-between"
            >
              Crea nuovo blocco <PlusIcon />
            </li>
          </ul>
        </div>

        <div className="w-full xl:w-6/12 flex flex-col items-center justify-center xl:mx-4">
          <div className="w-full bg-white p-6 rounded-xl shadow-xl flex flex-col gap-4 flex-1">
            <h2 className="text-xl font-semibold text-gray-800">
              {selectedPaste.created_at
                ? `Paste del ${new Date(
                    selectedPaste.created_at
                  ).toLocaleString("it-IT")}`
                : "Nuovo blocco appunti"}
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
              placeholder="Inserisci un titolo"
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
                  })
                }
              >
                Salva appunti
                <Save className="ml-3" />
              </button>
            ) : (
              <button
                className="p-3 bg-red-400 text-white rounded-lg font-semibold cursor-pointer transition flex justify-center"
                onClick={() => handlePasteDelete(selectedPaste.id)}
              >
                Archivia questi appunti
                <ArchiveIcon className="ml-3" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full xl:w-4/12 bg-white p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-gray-800">Documenti</h2>

          <ul className=" overflow-y-auto">
            {archiveItems.map((archive) => (
              <li className="w-full bg-white p-2 rounded-xl" key={archive.id}>
                {/* File Input */}
                <label className="w-full p-6 gap-4 flex justify-between items-center border-2 border-gray-300 rounded-lg">
                  <span className="text-gray-600 whitespace-nowrap">
                    <span className="hidden lg:inline font-semibold">
                      {archive.title.slice(0, 45)}
                    </span>
                    <span className="inline lg:hidden font-semibold">
                      {archive.title.slice(0, 18)}
                    </span>
                    <br />
                    <span>
                      {new Date(archive.created_at).toLocaleString("it-IT")}
                    </span>
                  </span>
                  <span className="flex gap-4">
                    <Download
                      onClick={() => handleArchiveDownload(archive.path)}
                      className="w-7 h-7 text-blue-600 hover:text-blue-700 transition cursor-pointer mb-2"
                    />

                    <Delete
                      onClick={() => handleArchiveDelete(archive.id)}
                      className="w-7 h-7 text-red-600 hover:text-red-700 transition cursor-pointer mb-2"
                      size={8}
                    />
                  </span>
                </label>
              </li>
            ))}

            <li className="w-full bg-white p-2 rounded-xl flex flex-col gap-4">
              {/* File Input */}
              <label className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                <span className="text-gray-600">
                  {isUploading ? (
                    <div className="flex align-middle justify-between gap-3">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-900 rounded-full animate-spin"></div>
                      </div>
                      Carico {file.name.slice(0, 35)}...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      Clicca per caricare un allegato
                      <CloudUpload className="w-7 h-7 mt-2 text-blue-500 mb-2" />
                    </div>
                  )}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </li>
          </ul>
        </div>
      </div>
    </Fragment>
  );
}
