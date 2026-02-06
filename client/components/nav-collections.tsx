"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Folder,
  FolderPlus,
  MoreHorizontal,
  FilePlus,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { CreateCollectionDialog } from "@/components/create-collection-dialog"

interface Collection {
  id: string
  name: string
  count: number
}

export function NavCollections() {
  const { isMobile } = useSidebar()
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Track which collection we're adding files to (null = creating new)
  const [addToCollection, setAddToCollection] = useState<string | null>(null)

  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/docs/document-groups')
      if (response.ok) {
        const data = await response.json()
        setCollections(data.groups || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  const handleCollectionCreated = () => {
    // Refresh collections list after a new one is created
    fetchCollections()
    // Reset add-to-collection state
    setAddToCollection(null)
  }
  
  const handleOpenCreateDialog = () => {
    setAddToCollection(null)
    setDialogOpen(true)
  }
  
  const handleAddFilesToCollection = (collectionName: string) => {
    setAddToCollection(collectionName)
    setDialogOpen(true)
  }
  
  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setAddToCollection(null)
    }
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Collections</SidebarGroupLabel>
      <SidebarMenu>
        {isLoading ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span className="text-muted-foreground text-sm">Loading...</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : collections.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span className="text-muted-foreground text-sm">No collections</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          collections.map((collection) => (
            <SidebarMenuItem key={collection.id}>
              <SidebarMenuButton asChild>
                <a href={`/collections/${encodeURIComponent(collection.id)}`}>
                  <Folder className="h-4 w-4" />
                  <span>{collection.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {collection.count}
                  </span>
                </a>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem asChild>
                    <a href={`/collections/${encodeURIComponent(collection.id)}`}>
                      <Folder className="text-muted-foreground" />
                      <span>View Collection</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddFilesToCollection(collection.name)}>
                    <FilePlus className="text-muted-foreground" />
                    <span>Add Files</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))
        )}
        
        {/* Create New Collection */}
        <SidebarMenuItem>
          <SidebarMenuButton 
            className="text-muted-foreground hover:text-foreground"
            onClick={handleOpenCreateDialog}
          >
            <FolderPlus className="h-4 w-4" />
            <span>Create New Collection</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Create Collection Dialog - used for both creating new and adding to existing */}
      <CreateCollectionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={handleCollectionCreated}
        existingCollectionName={addToCollection || undefined}
      />
    </SidebarGroup>
  )
}
