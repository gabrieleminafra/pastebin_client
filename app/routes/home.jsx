import io from "socket.io-client";
import client from "axios";
import toast, { Toaster } from "react-hot-toast";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CloudUpload,
  Download,
  PlusIcon,
  Save,
  Trash,
  X,
} from "lucide-react";
import empty_1 from "../assets/empty_1.png";
import empty_2 from "../assets/empty_2.png";

export function meta() {
  return [{ title: "Pastebin" }];
}

const INITIAL_PASTE_DATA = {
  id: null,
  title: "",
  content: "",
};

const UploadedFile = ({
  archive,
  handleArchiveDownload,
  handleArchiveDelete,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  return (
    <li className="w-full bg-white rounded-xl" key={archive.id}>
      {/* File Input */}
      <label className="w-full p-6 gap-4 flex justify-between items-center border-2 border-gray-300 rounded-lg">
        <div className="text-gray-600 whitespace-nowrap w-10/12 overflow-hidden">
          <span className="font-semibold">{archive.title}</span>
          <br />
          <span>{new Date(archive.created_at).toLocaleString("it-IT")}</span>
        </div>
        <div className="flex items-baseline gap-4">
          {!isDownloading ? (
            <Download
              onClick={() =>
                handleArchiveDownload(
                  archive.id,
                  archive.title,
                  setIsDownloading
                )
              }
              className="w-7 h-7 text-blue-600 hover:text-blue-700 transition cursor-pointer mb-2"
            />
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-7 h-7 border-4 border-blue-300 border-t-blue-900 rounded-full animate-spin"></div>
            </div>
          )}

          <Trash
            onClick={() => handleArchiveDelete(archive.id)}
            className="w-7 h-7 text-red-600 hover:text-red-700 transition cursor-pointer mb-2"
            size={8}
          />
        </div>
      </label>
    </li>
  );
};

export default function Home() {
  const socketRef = useRef(null);

  const [selectedPaste, setSelectedPaste] = useState(null);
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
      toast.error("Caricamento non riuscito. Il file non deve superare 1GB");
    }
    setIsUploading(false);
    setFile(null);
  };

  const handleArchiveDownload = async (id, fileName, onDownloadEvent) => {
    onDownloadEvent(true);

    try {
      const { data } = await client.get(
        `${import.meta.env.VITE_API_ENDPOINT}/archive/get`,
        { params: { id }, responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download non riuscito. Riprova tra qualche secondo");
      console.error(error);
    }
    onDownloadEvent(false);
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
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_API_ENDPOINT, {
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        handleInitialLoad();
      });

      socketRef.current.on("disconnect", () => {
        setIsLoading(true);
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
    if (!pasteItems || !selectedPaste?.id) return;
    const workingItem = pasteItems.find((item) => item.id == selectedPaste.id);

    if (workingItem && isFocused) {
      return;
    }

    if (!workingItem) {
      setSelectedPaste(null);
      return;
    }

    setSelectedPaste(workingItem ?? selectedPaste);
  }, [pasteItems]);

  const emitUpdateEvent = () => {
    if (!selectedPaste?.id) return;
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
      {/* {isLoading && ( */}
      <div
        className={`${
          isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        } fixed inset-0 flex items-center justify-center transition-opacity duration-500 bg-white/50`}
      >
        <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-lg opacity-100">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">Sincronizzo...</p>
        </div>
      </div>
      {/* )} */}

      <div className="flex flex-col xl:flex-row h-lvh bg-gray-100 p-4 py-12 gap-8 xl:gap-4">
        <div className="w-full xl:min-w-3/12 flex-1 bg-white p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col justify-between h-full gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Appunti</h2>
            {!isLoading && pasteItems.length == 0 && (
              <div className="h-full grid place-content-center">
                <img
                  className="aspect-square h-56 grayscale opacity-70"
                  src={empty_1}
                />
              </div>
            )}
            <ul className="space-y-3 overflow-y-auto grow">
              {pasteItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => setSelectedPaste(item)}
                  className={`p-3 hover:bg-gray-400 rounded-lg text-gray-700 font-semibold cursor-pointer transition ${
                    selectedPaste?.id === item.id ? "bg-sky-300" : "bg-gray-200"
                  }`}
                >
                  {item.title.slice(0, 30)}
                </li>
              ))}
            </ul>
            <div className="space-y-3 ">
              <button
                onClick={() => setSelectedPaste(INITIAL_PASTE_DATA)}
                className="p-3 w-full bg-sky-600 hover:bg-sky-800 rounded-lg text-white font-semibold transition flex justify-center cursor-pointer gap-4"
              >
                Crea nuovo blocco <PlusIcon />
              </button>
            </div>
          </div>
        </div>

        {selectedPaste && (
          <div className="w-full xl:w-5/12 flex flex-col items-center justify-center">
            <div className="w-full bg-white p-6 rounded-xl shadow-xl flex flex-col gap-4 flex-1">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedPaste.created_at
                    ? `Paste del ${new Date(
                        selectedPaste.created_at
                      ).toLocaleString("it-IT")}`
                    : "Nuova bozza appunti"}
                </h2>
                <X onClick={() => setSelectedPaste(null)} />
              </div>
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
                  className="p-3 bg-sky-600 hover:bg-sky-800 rounded-lg font-semibold text-white cursor-pointer transition flex justify-center gap-4"
                  onClick={() =>
                    handlePastePublish({
                      title: selectedPaste.title,
                      content: selectedPaste.content,
                    })
                  }
                >
                  Salva appunti
                  <Save />
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
        )}

        <div className="w-full xl:min-w-4/12 flex-1 bg-white p-6 rounded-2xl shadow-xl">
          <div className="flex flex-col justify-between h-full gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Documenti</h2>

            <ul className="overflow-y-auto grow space-y-3 ">
              {!isLoading && archiveItems.length == 0 && (
                <div className="h-full grid place-content-center">
                  <img
                    className="aspect-square h-56 grayscale opacity-70"
                    src={empty_2}
                  />
                </div>
              )}
              {archiveItems.map((archive) => (
                <UploadedFile
                  key={archive.id}
                  archive={archive}
                  handleArchiveDelete={handleArchiveDelete}
                  handleArchiveDownload={handleArchiveDownload}
                />
              ))}
            </ul>

            <div className="w-full bg-white rounded-xl flex flex-col">
              {/* File Input */}
              <label
                className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg ${
                  isUploading
                    ? "animate-pulse"
                    : "cursor-pointer hover:border-blue-400"
                }`}
              >
                <div className="text-gray-600">
                  {isUploading ? (
                    <div className="flex items-center justify-between gap-4 ">
                      <div className="flex items-center justify-center py-4">
                        <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-900 rounded-full animate-spin"></div>
                      </div>
                      <span>Carico {file?.name.slice(0, 35)}...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-4 my-2">
                      <span>Carica un documento</span>
                      <CloudUpload className="w-7 h-7  text-blue-500" />
                    </div>
                  )}
                </div>
                <input
                  disabled={isUploading}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
