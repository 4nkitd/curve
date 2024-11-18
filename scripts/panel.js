var syncedBookmarkFolderID = null;

document.addEventListener("DOMContentLoaded", () => {
	getBookmarks();
	eventListeners();
});

async function getBookmarks() {
	const bookmarkTreeNodes = await chrome.bookmarks.getTree();
	bookmarkTreeNodes.forEach(bookmarkTreeNode => {
		setTimeout(() => processBookmarks(bookmarkTreeNode), 100);
	});

	setTimeout(() => {
		removeIfLoadingScreen();
		cleanEmptyFolders();
	}, 300);
}

function processBookmarks(bookmarkNode) {
	if (bookmarkNode.children) {
		renderFolder("curve-bookmark-list", bookmarkNode);
		bookmarkNode.children.forEach(processBookmarks);
	} else {
		renderBookmarks(bookmarkNode.parentId, bookmarkNode);
	}
}

function renderFolder(elm, folder) {
	if (folder.title === "Synced Bookmarks") {
		syncedBookmarkFolderID = folder.id;
		folder.children.forEach((bookmark) => {
			if (!bookmark.children) {
				renderBookmarks(elm, bookmark);
			}
		});
		return;
	}

	const folderHtml = `
		<li class="mb-2 cursor-pointer">
			<div class="folder-header bg-gray-700 text-white px-4 py-2 rounded-lg flex justify-between items-center">
				<span class="material-symbols-outlined text-md">folder</span>
				<span class="float-start">${folder.title}</span>
				<span class="material-symbols-outlined">expand_more</span>
			</div>
			<ul id="folder-${folder.id}" class="folder-content hidden pl-4"></ul>
		</li>
	`;
	document.getElementById(elm).insertAdjacentHTML("beforeend", folderHtml);

	document
		.querySelector(`#folder-${folder.id}`)
		.previousElementSibling.addEventListener("click", () => {
			const allFolders = document.querySelectorAll(".folder-content");
			allFolders.forEach(f => {
				if (f.id !== `folder-${folder.id}`) {
					f.classList.add("hidden");
				}
			});
			document.getElementById(`folder-${folder.id}`).classList.toggle("hidden");
		});
}

  

function renderBookmarks(parentId, bookmark) {

	const elmHtml = `
		<li class="mb-2 relative group" data-bookmark-id="${bookmark.id}">
			<a data-bookmark-action="OpenLinkINCurrentTab" data-bookmark-value="${bookmark.url}" href="#" class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white flex items-center bg-gray-800 rounded-lg divide-current hover:shadow-md">
				<img data-bookmark-action="OpenLinkINCurrentTab" data-bookmark-value="${bookmark.url}" src="http://www.google.com/s2/favicons?domain=${bookmark.url}" class="w-4 h-4 mr-2" alt="Dashboard Icon" />
				<span data-bookmark-action="OpenLinkINCurrentTab" data-bookmark-value="${bookmark.url}" class="truncate w-48 hover:w-full">${bookmark.title}</span>
				<button data-bookmark-action="bookmark_action_delete" data-bookmark-value="${bookmark.id}" class="absolute right-2 top-2 bg-red-500 hover:bg-red-700 text-white rounded w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<span data-bookmark-action="bookmark_action_delete" data-bookmark-value="${bookmark.id}"  class="material-symbols-outlined text-sm">close</span>
					<span data-bookmark-action="bookmark_action_delete" data-bookmark-value="${bookmark.id}"  class="sr-only">Delete</span>
				</button>
				<button data-bookmark-action="bookmark_action_new_tab" data-bookmark-value="${bookmark.url}" class="absolute right-10 top-2 bg-blue-500 hover:bg-blue-700 text-white rounded w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<span data-bookmark-action="bookmark_action_new_tab" data-bookmark-value="${bookmark.url}" class="material-symbols-outlined text-sm">arrow_forward</span>
					<span data-bookmark-action="bookmark_action_new_tab" data-bookmark-value="${bookmark.url}" class="sr-only">Move</span>
				</button>
			</a>
		</li>
	`;
	if (document.getElementById(`folder-${parentId}`)) {
		document.getElementById(`folder-${parentId}`).insertAdjacentHTML('beforeend', elmHtml);
	} else {
		document.getElementById("curve-bookmark-list").insertAdjacentHTML('beforeend', elmHtml);
	}
}

function cleanEmptyFolders() {
	const folders = document.querySelectorAll("#curve-bookmark-list .folder-content");
	folders.forEach(folder => {
		if (folder.children.length === 0) {
			folder.parentElement.remove();
		}
	});
}

function cleanBookmarkList(empty = false) {
	const bookmarkList = document.getElementById("curve-bookmark-list");
	bookmarkList.innerHTML = empty ? "" : renderLoadingScreen();
}

function bookmarkAction(elm, id, action) {
	document.getElementById(elm).innerHTML = renderLoadingScreen();

	if (action === "delete") {
		chrome.bookmarks.remove(id, () => {
			cleanBookmarkList();
			getBookmarks();
		});
	}
}

function removeIfLoadingScreen() {
	const loaderBookmark = document.getElementById("loader-bookmark");
	if (loaderBookmark) {
		loaderBookmark.remove();
	}
}

function renderLoadingScreen() {
	return `
		<div id="loader-bookmark" class="flex items-center justify-center h-full">
			<span class="loading loading-infinity loading-lg"></span>
		</div>
	`;
}

function openLinkInCurrentTab(url, newTab = false) {
	if (newTab) {
		chrome.tabs.create({ url, active: true });
	} else {
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			chrome.tabs.update(tabs[0].id, { url });
		});
	}
}

function addCurrentTabToBookmark() {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		const tabData = tabs[0];
		chrome.bookmarks.create({
			parentId: syncedBookmarkFolderID,
			title: tabData.title,
			url: tabData.url
		}, function(newFolder) {
			console.log("Added newFolder: " + newFolder);
			cleanBookmarkList();
			getBookmarks();
		});
	});
}

function editFolderTitle(folderId) {
	const folderElement = document.querySelector(`#folder-${folderId}`).previousElementSibling;
	const currentTitle = folderElement.querySelector("span.float-start").textContent;

	const popupHtml = `
		<div class="modal" id="edit-folder-modal">
			<div class="modal-box">
				<h3 class="font-bold text-lg">Edit Folder Title</h3>
				<input type="text" id="new-folder-title" class="input input-bordered w-full my-4" value="${currentTitle}">
				<div class="modal-action">
					<a href="#" class="btn" id="save-folder-title">Save</a>
					<a href="#" class="btn btn-ghost" id="cancel-edit-folder">Cancel</a>
				</div>
			</div>
		</div>
	`;

	document.body.insertAdjacentHTML("beforeend", popupHtml);
	document.getElementById("edit-folder-modal").classList.add("modal-open");

	document.getElementById("save-folder-title").addEventListener("click", () => {
		const newTitle = document.getElementById("new-folder-title").value;
		chrome.bookmarks.update(folderId, { title: newTitle }, () => {
			folderElement.querySelector("span.float-start").textContent = newTitle;
			document.getElementById("edit-folder-modal").remove();
		});
	});

	document.getElementById("cancel-edit-folder").addEventListener("click", () => {
		document.getElementById("edit-folder-modal").remove();
	});
}

function eventListeners() {
	document.addEventListener("click", event => {
		const action = event.target.getAttribute("data-bookmark-action");
		const value = event.target.getAttribute("data-bookmark-value");

		switch (action) {
			case "bookmark_action_delete":
				bookmarkAction("curve-bookmark-list", value, "delete");
				break;
			case "bookmark_action_new_tab":
				openLinkInCurrentTab(value, true);
				break;
			case "OpenLinkINCurrentTab":
				openLinkInCurrentTab(value);
				break;
			case "add_current_tab_to_bookmark":
				addCurrentTabToBookmark();
				break;
		}
	});

	document.getElementById("bookmark-search").addEventListener("keyup", event => {
		const searchTerm = event.target.value.toLowerCase();
		const bookmarks = document.querySelectorAll("#curve-bookmark-list li");

		bookmarks.forEach(bookmark => {
			const title = bookmark.querySelector("span").textContent.toLowerCase();
			const folder = bookmark.closest(".folder-content");
			const folderHeader = folder ? folder.previousElementSibling : null;

			if (title.includes(searchTerm)) {
				bookmark.style.display = "block";
				if (folderHeader) {
					folderHeader.style.display = "block";
					folder.style.display = "block";
					folder.classList.remove('hidden'); // Expand the folder
				}
			} else {
				bookmark.style.display = "none";
			}
		});

		// Hide empty folders
		const folders = document.querySelectorAll("#curve-bookmark-list .folder-content");
		folders.forEach(folder => {
			const visibleBookmarks = folder.querySelectorAll("li[style='display: block;']");
			if (visibleBookmarks.length === 0) {
				folder.style.display = "none";
				folder.previousElementSibling.style.display = "none";
			}
		});
	});
}
