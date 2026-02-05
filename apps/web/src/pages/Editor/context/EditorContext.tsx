import React, { createContext, useContext, type ReactNode } from 'react';
import { useFabricEditor } from '../../../hooks/useFabricEditor';
import { useEditorLifecycle } from '../../../hooks/useEditorLifecycle';
import { useAuth } from '../../../contexts/AuthContext';

type EditorContextType = ReturnType<typeof useFabricEditor> &
    ReturnType<typeof useEditorLifecycle> & {
        user: any;
        handleActionClick: (action: string) => void;
    };

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const fabricEditor = useFabricEditor();
    const editorLifecycle = useEditorLifecycle(fabricEditor.fabricCanvas);

    const handleActionClick = (action: string) => {
        if (!user) {
            editorLifecycle.setPendingAction(action);
            editorLifecycle.setShowLoginPrompt(true);
            return;
        }
        if (action === 'export') {
            const link = document.createElement('a');
            link.download = 'screenshot.png';
            link.href = fabricEditor.fabricCanvas.current?.toDataURL({ format: 'png' }) || '';
            link.click();
        } else if (action === 'share') {
            editorLifecycle.handleUploadToCloud();
        }
    };

    const value = {
        ...fabricEditor,
        ...editorLifecycle,
        user,
        handleActionClick,
    };

    // Auto-trigger pending action when user logs in
    React.useEffect(() => {
        if (user && editorLifecycle.pendingAction) {
            handleActionClick(editorLifecycle.pendingAction);
            editorLifecycle.setPendingAction(null);
        }
    }, [user, editorLifecycle.pendingAction, handleActionClick]);

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};
