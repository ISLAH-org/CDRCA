// this sends request to backend
// file system is a nested obj (hashmap) to represent folders and string as values for files
async function transpileCDRCA(fileSystem) {
  console.log(fileSystem);
  const response = await fetch("/api/transpileCDRCA", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileSystem }),
  });
  let r = response.json();
  console.log(r);
  return r;
}
