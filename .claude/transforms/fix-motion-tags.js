module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  
  // Fix motion.div closed with </div>
  root.find(j.JSXElement)
    .filter(path => {
      const opening = path.node.openingElement;
      const closing = path.node.closingElement;
      return opening && 
             getElementName(opening.name) === 'motion.div' &&
             closing &&
             getElementName(closing.name) === 'div';
    })
    .forEach(path => {
      path.node.closingElement.name = j.jsxMemberExpression(
        j.jsxIdentifier('motion'),
        j.jsxIdentifier('div')
      );
    });
  
  return root.toSource();
};

function getElementName(node) {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${getElementName(node.object)}.${node.property.name}`;
  }
  return 'unknown';
}
